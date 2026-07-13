import assert from 'node:assert/strict';
import test from 'node:test';
import { validateWorkflowPageChain } from './validate-workflow-page-chain.mjs';

const repository = 'MirrorCartographer/mirror-cartographer-ui';
const commit = 'a'.repeat(40);
const version = '2026-03-10';
const base = `https://api.github.com/repos/${repository}/actions/runs?head_sha=${commit}&per_page=100`;
const digest = 'b'.repeat(64);

function valid() {
  return {
    schema_version: 1,
    repository,
    commit_sha: commit,
    api_version: version,
    pages: [
      {
        page: 1,
        request_url: base,
        status: 200,
        retrieved_at: '2026-07-13T21:54:00Z',
        body_sha256: digest,
        record_ids: [10, 11],
        response_headers: {
          'x-github-api-version-selected': version,
          'x-github-request-id': 'REQ-1',
          link: `<${base}&page=2>; rel="next"`
        }
      },
      {
        page: 2,
        request_url: `${base}&page=2`,
        status: 200,
        retrieved_at: '2026-07-13T21:54:01Z',
        body_sha256: 'c'.repeat(64),
        record_ids: [12],
        response_headers: {
          'x-github-api-version-selected': version,
          'x-github-request-id': 'REQ-2'
        }
      }
    ]
  };
}

test('accepts an intact page chain', () => {
  const result = validateWorkflowPageChain(valid());
  assert.equal(result.verified, true);
  assert.equal(result.page_count, 2);
  assert.equal(result.record_count, 3);
});

test('rejects a broken Link next relation', () => {
  const input = valid();
  input.pages[0].response_headers.link = `<${base}&page=3>; rel="next"`;
  assert.equal(validateWorkflowPageChain(input).reason, 'link_chain_mismatch');
});

test('rejects duplicate request ids', () => {
  const input = valid();
  input.pages[1].response_headers['x-github-request-id'] = 'REQ-1';
  assert.equal(validateWorkflowPageChain(input).reason, 'duplicate_request_id');
});

test('rejects duplicate workflow run ids across pages', () => {
  const input = valid();
  input.pages[1].record_ids = [11];
  assert.equal(validateWorkflowPageChain(input).reason, 'duplicate_record_id');
});

test('rejects a terminal page that still advertises next', () => {
  const input = valid();
  input.pages[1].response_headers.link = `<${base}&page=3>; rel="next"`;
  assert.equal(validateWorkflowPageChain(input).reason, 'link_chain_mismatch');
});
