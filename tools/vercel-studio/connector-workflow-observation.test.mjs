import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyConnectorWorkflowObservation } from './connector-workflow-observation.mjs';

const sha = 'b'.repeat(40);
const time = '2026-07-13T05:05:14Z';

test('zero results from limited connector scope remain absence unproven', () => {
  const result = classifyConnectorWorkflowObservation({ commit_sha: sha, workflow_runs: [], retrieved_at: time });
  assert.equal(result.status, 'absence_unproven');
  assert.equal(result.eligible_for_completion_claim, false);
});

test('positive limited observations remain ineligible for completion claims', () => {
  const result = classifyConnectorWorkflowObservation({
    commit_sha: sha,
    workflow_runs: [{ id: 7, head_sha: sha }],
    retrieved_at: time
  });
  assert.equal(result.status, 'limited_positive_observation');
  assert.equal(result.eligible_for_completion_claim, false);
});

test('exhaustive positive observations can advance to downstream assessment', () => {
  const result = classifyConnectorWorkflowObservation({
    commit_sha: sha,
    workflow_runs: [{ id: 8, head_sha: sha }],
    connector_scope: 'all_events_exhaustive',
    retrieved_at: time
  });
  assert.equal(result.status, 'exhaustive_positive_observation');
  assert.equal(result.eligible_for_completion_claim, true);
});

test('cross-commit and duplicate runs fail closed', () => {
  assert.throws(() => classifyConnectorWorkflowObservation({
    commit_sha: sha,
    workflow_runs: [{ id: 9, head_sha: 'c'.repeat(40) }],
    retrieved_at: time
  }), /cross-commit/);

  assert.throws(() => classifyConnectorWorkflowObservation({
    commit_sha: sha,
    workflow_runs: [{ id: 9, head_sha: sha }, { id: 9, head_sha: sha }],
    retrieved_at: time
  }), /duplicate/);
});
