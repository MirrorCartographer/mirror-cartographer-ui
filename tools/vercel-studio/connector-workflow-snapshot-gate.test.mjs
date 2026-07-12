import assert from 'node:assert/strict';
import test from 'node:test';
import { assessConnectorWorkflowSnapshot } from './connector-workflow-snapshot-gate.mjs';

const sha = '2d63dbcd02bc12b1acead87847a2963e713f48ee';
const limitedTransport = {
  authenticated: true,
  provider: 'github_connector',
  event_scope: 'pull_request_only',
  pagination_scope: 'first_page_only'
};

test('zero connector runs remains absence_unproven', () => {
  const result = assessConnectorWorkflowSnapshot({ commitSha: sha, workflowRuns: [], transport: limitedTransport });
  assert.equal(result.exhaustive, false);
  assert.equal(result.finding, 'absence_unproven');
  assert.equal(result.evidence_strength, 'limited');
});

test('matching connector run is retained but limited', () => {
  const result = assessConnectorWorkflowSnapshot({
    commitSha: sha,
    workflowRuns: [{ id: 1, head_sha: sha, event: 'pull_request', status: 'completed', conclusion: 'success' }],
    transport: limitedTransport
  });
  assert.equal(result.finding, 'runs_observed_limited');
  assert.equal(result.matching_runs.length, 1);
  assert.equal(result.exhaustive, false);
});

test('cross-commit records fail closed', () => {
  const result = assessConnectorWorkflowSnapshot({
    commitSha: sha,
    workflowRuns: [{ id: 2, head_sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }],
    transport: limitedTransport
  });
  assert.equal(result.finding, 'invalid_observation');
  assert.deepEqual(result.errors, ['cross_commit_contamination']);
});

test('connector cannot self-declare exhaustive coverage', () => {
  const result = assessConnectorWorkflowSnapshot({
    commitSha: sha,
    workflowRuns: [],
    transport: { authenticated: true, provider: 'github_connector', event_scope: 'all_events', pagination_scope: 'all_pages' }
  });
  assert.equal(result.evidence_strength, 'rejected');
  assert.ok(result.errors.includes('connector_snapshot_must_use_exhaustive_enumerator'));
});
