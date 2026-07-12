import assert from 'node:assert/strict';
import test from 'node:test';
import { assessWorkflowRunCoverage } from './github-actions-run-coverage.mjs';

const sha = 'a'.repeat(40);

test('empty incomplete observation cannot prove absence', () => {
  const result = assessWorkflowRunCoverage({
    commitSha: sha,
    pages: [{ workflow_runs: [] }],
    query: { all_events: false, all_pages: false, per_page: 30 }
  });
  assert.equal(result.finding, 'absence_unproven');
  assert.equal(result.evidence_strength, 'limited');
});

test('empty exhaustive observation records no runs', () => {
  const result = assessWorkflowRunCoverage({
    commitSha: sha,
    pages: [{ workflow_runs: [] }],
    query: { all_events: true, all_pages: true, per_page: 100 }
  });
  assert.equal(result.finding, 'no_runs_observed_exhaustively');
  assert.equal(result.evidence_strength, 'strong');
});

test('matching runs are retained', () => {
  const run = { id: 7, head_sha: sha, event: 'push', status: 'completed', conclusion: 'success' };
  const result = assessWorkflowRunCoverage({
    commitSha: sha,
    pages: [{ workflow_runs: [run] }],
    query: { all_events: true, all_pages: true, per_page: 100 }
  });
  assert.equal(result.finding, 'runs_observed');
  assert.equal(result.matching_runs.length, 1);
});

test('cross commit contamination is rejected', () => {
  const result = assessWorkflowRunCoverage({
    commitSha: sha,
    pages: [{ workflow_runs: [{ id: 8, head_sha: 'b'.repeat(40) }] }],
    query: { all_events: true, all_pages: true, per_page: 100 }
  });
  assert.equal(result.finding, 'invalid_observation');
  assert.ok(result.errors.includes('cross_commit_contamination'));
});

test('malformed pages are rejected', () => {
  const result = assessWorkflowRunCoverage({
    commitSha: sha,
    pages: [{}],
    query: { all_events: true, all_pages: true, per_page: 100 }
  });
  assert.equal(result.finding, 'invalid_observation');
});
