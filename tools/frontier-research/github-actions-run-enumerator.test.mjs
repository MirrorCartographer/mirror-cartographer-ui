import test from 'node:test';
import assert from 'node:assert/strict';
import { enumerateWorkflowRuns } from './github-actions-run-enumerator.mjs';

const sha = 'a'.repeat(40);
const other = 'b'.repeat(40);

function response(body, { status = 200, link = null } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: name => name.toLowerCase() === 'link' ? link : null },
    json: async () => body
  };
}

test('enumerates all pages without event filtering and rejects cross-commit runs', async () => {
  const seen = [];
  const fetchImpl = async url => {
    seen.push(url);
    if (seen.length === 1) {
      return response({ workflow_runs: [{ id: 1, head_sha: sha }, { id: 2, head_sha: other }] }, {
        link: '<https://api.github.com/page/2>; rel="next"'
      });
    }
    return response({ workflow_runs: [{ id: 3, head_sha: sha }] });
  };

  const result = await enumerateWorkflowRuns({ owner: 'o', repo: 'r', commitSha: sha, fetchImpl });
  assert.equal(result.complete, true);
  assert.equal(result.pagesFetched, 2);
  assert.deepEqual(result.runs.map(run => run.id), [1, 3]);
  assert.equal(result.coverage.eventFilterApplied, false);
  assert.equal(result.coverage.paginationExhausted, true);
  assert.match(seen[0], /head_sha=/);
  assert.doesNotMatch(seen[0], /event=/);
});

test('fails closed when the page limit is reached', async () => {
  const fetchImpl = async () => response({ workflow_runs: [] }, {
    link: '<https://api.github.com/page/2>; rel="next"'
  });
  const result = await enumerateWorkflowRuns({ owner: 'o', repo: 'r', commitSha: sha, fetchImpl, maxPages: 1 });
  assert.equal(result.complete, false);
  assert.equal(result.reason, 'page_limit_reached');
});

test('fails closed on an HTTP error', async () => {
  const result = await enumerateWorkflowRuns({
    owner: 'o', repo: 'r', commitSha: sha,
    fetchImpl: async () => response({}, { status: 403 })
  });
  assert.equal(result.complete, false);
  assert.equal(result.reason, 'http_403');
});

test('requires a full commit SHA', async () => {
  await assert.rejects(
    () => enumerateWorkflowRuns({ owner: 'o', repo: 'r', commitSha: 'abc', fetchImpl: async () => response({}) }),
    /40-character/
  );
});
