import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCommitBoundWorkflowEvidence } from './commit-bound-workflow-evidence.mjs';

const sha = 'a'.repeat(40);
const complete = {
  complete: true,
  reason: 'exhausted_pagination',
  commitSha: sha,
  pagesFetched: 2,
  runs: [{ id: 7, head_sha: sha, event: 'push', status: 'completed', conclusion: 'success', html_url: 'https://example.test/run/7' }],
  coverage: {
    eventFilterApplied: false,
    headShaFilterApplied: true,
    perPage: 100,
    paginationExhausted: true,
    crossCommitRunsRejected: true
  }
};

test('accepts only a complete exhaustive exact-commit enumeration', () => {
  const result = buildCommitBoundWorkflowEvidence({ commitSha: sha, enumeration: complete });
  assert.equal(result.exhaustive, true);
  assert.equal(result.finding, 'runs_observed');
  assert.equal(result.evidence_strength, 'strong');
  assert.equal(result.matching_runs.length, 1);
  assert.deepEqual(result.errors, []);
});

test('preserves exhaustive zero-run evidence', () => {
  const result = buildCommitBoundWorkflowEvidence({ commitSha: sha, enumeration: { ...complete, runs: [] } });
  assert.equal(result.finding, 'no_runs_observed_exhaustively');
  assert.equal(result.exhaustive, true);
  assert.equal(result.enumeration.run_count, 0);
});

test('rejects page-limit and HTTP incomplete enumerations', () => {
  for (const reason of ['page_limit_reached', 'http_403']) {
    const result = buildCommitBoundWorkflowEvidence({ commitSha: sha, enumeration: { ...complete, complete: false, reason } });
    assert.equal(result.finding, 'invalid_observation');
    assert.equal(result.evidence_strength, 'rejected');
    assert.match(result.errors[0], /^incomplete_enumeration:/);
  }
});

test('rejects mismatched commit and weakened coverage contracts', () => {
  const mismatch = buildCommitBoundWorkflowEvidence({ commitSha: sha, enumeration: { ...complete, commitSha: 'b'.repeat(40) } });
  assert.deepEqual(mismatch.errors, ['enumeration_commit_mismatch']);

  const weakened = buildCommitBoundWorkflowEvidence({
    commitSha: sha,
    enumeration: { ...complete, coverage: { ...complete.coverage, eventFilterApplied: true } }
  });
  assert.deepEqual(weakened.errors, ['enumeration_coverage_contract_failed']);
});
