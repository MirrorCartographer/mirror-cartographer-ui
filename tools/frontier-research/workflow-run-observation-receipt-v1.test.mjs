import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalSha256, validateWorkflowRunObservationReceipt } from './workflow-run-observation-receipt-v1.mjs';

const sha = 'a'.repeat(40);

function page(number, runs, next = null) {
  const rawResponse = { total_count: runs.length, workflow_runs: runs };
  return {
    page: number,
    status: 200,
    link: { next },
    rawResponse,
    responseDigest: canonicalSha256(rawResponse),
    workflowRuns: runs
  };
}

function receipt(overrides = {}) {
  const runs = [{ id: 11, head_sha: sha }, { id: 12, head_sha: sha }];
  return {
    schemaVersion: 1,
    headSha: sha,
    start: '2026-07-15T00:00:00Z',
    end: '2026-07-15T00:00:59Z',
    retrievedAt: '2026-07-15T12:58:00Z',
    totalCount: 2,
    request: {
      method: 'GET',
      apiVersion: '2022-11-28',
      accept: 'application/vnd.github+json',
      headSha: sha,
      created: '2026-07-15T00:00:00Z..2026-07-15T00:00:59Z',
      perPage: 100
    },
    pages: [page(1, runs)],
    ...overrides
  };
}

test('accepts a complete exact-commit retained observation', () => {
  const result = validateWorkflowRunObservationReceipt(receipt());
  assert.equal(result.verified, true);
  assert.equal(result.paginationComplete, true);
  assert.equal(result.pageCount, 1);
  assert.match(result.receiptDigest, /^[0-9a-f]{64}$/);
});

test('rejects altered raw response after digest retention', () => {
  const candidate = receipt();
  candidate.pages[0].rawResponse.workflow_runs[0].id = 999;
  assert.throws(() => validateWorkflowRunObservationReceipt(candidate), /response_digest_mismatch/);
});

test('rejects a cross-commit workflow run', () => {
  const candidate = receipt();
  candidate.pages[0].workflowRuns[1].head_sha = 'b'.repeat(40);
  candidate.pages[0].rawResponse.workflow_runs[1].head_sha = 'b'.repeat(40);
  candidate.pages[0].responseDigest = canonicalSha256(candidate.pages[0].rawResponse);
  assert.throws(() => validateWorkflowRunObservationReceipt(candidate), /cross_commit_run/);
});

test('rejects duplicate run identifiers', () => {
  const candidate = receipt();
  candidate.pages[0].workflowRuns[1].id = 11;
  candidate.pages[0].rawResponse.workflow_runs[1].id = 11;
  candidate.pages[0].responseDigest = canonicalSha256(candidate.pages[0].rawResponse);
  assert.throws(() => validateWorkflowRunObservationReceipt(candidate), /duplicate_run_id/);
});

test('rejects incomplete pagination when a next link remains', () => {
  const candidate = receipt();
  candidate.pages[0].link.next = 'https://api.github.com/example?page=2';
  assert.throws(() => validateWorkflowRunObservationReceipt(candidate), /pagination_incomplete/);
});

test('fails closed at the filtered-search provider ceiling', () => {
  const runs = Array.from({ length: 1000 }, (_, index) => ({ id: index + 1, head_sha: sha }));
  const pages = Array.from({ length: 10 }, (_, index) => page(index + 1, runs.slice(index * 100, (index + 1) * 100)));
  const result = validateWorkflowRunObservationReceipt(receipt({ totalCount: 1000, pages }));
  assert.equal(result.verified, false);
  assert.equal(result.providerCeilingAmbiguous, true);
  assert.deepEqual(result.failClosedReasons, ['provider_ceiling_ambiguous']);
});

test('rejects a request that is not bound to the receipt window', () => {
  const candidate = receipt();
  candidate.request.created = '2026-07-15T00:00:00Z..2026-07-15T00:01:00Z';
  assert.throws(() => validateWorkflowRunObservationReceipt(candidate), /request_window_mismatch/);
});
