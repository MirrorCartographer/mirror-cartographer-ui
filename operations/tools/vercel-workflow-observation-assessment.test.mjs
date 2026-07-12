import test from 'node:test';
import assert from 'node:assert/strict';
import { assessWorkflowObservation } from './vercel-workflow-observation-assessment.mjs';

const base = {
  repository: 'MirrorCartographer/mirror-cartographer-ui',
  commit_sha: '6fb752e32f1b5f93e47ab57600586fd2c922bb31',
  queried_at: '2026-07-12T20:10:48Z'
};

const incompleteScope = {
  event_filter: 'pull_request',
  pagination: 'first_page_only',
  exhaustive_events: false,
  exhaustive_pages: false
};

test('empty incomplete query cannot prove non-execution', () => {
  const result = assessWorkflowObservation({ ...base, workflow_runs: [], query_scope: incompleteScope });
  assert.equal(result.accepted, true);
  assert.equal(result.observable, false);
  assert.equal(result.exhaustive, false);
  assert.equal(result.decision, 'absence_unproven_due_incomplete_scope');
});

test('observed runs remain useful but non-exhaustive under incomplete scope', () => {
  const result = assessWorkflowObservation({
    ...base,
    query_scope: incompleteScope,
    workflow_runs: [{ id: 12, head_sha: base.commit_sha, event: 'pull_request', status: 'completed', conclusion: 'success' }]
  });
  assert.equal(result.observable, true);
  assert.equal(result.exhaustive, false);
  assert.equal(result.decision, 'runs_observed_under_incomplete_scope');
});

test('empty complete query can establish no observed runs', () => {
  const result = assessWorkflowObservation({
    ...base,
    workflow_runs: [],
    query_scope: { event_filter: 'all', pagination: 'all_pages', exhaustive_events: true, exhaustive_pages: true }
  });
  assert.equal(result.exhaustive, true);
  assert.equal(result.decision, 'no_runs_observed_under_complete_scope');
});

test('rejects cross-commit run contamination', () => {
  const result = assessWorkflowObservation({
    ...base,
    query_scope: incompleteScope,
    workflow_runs: [{ id: 13, head_sha: '1111111111111111111111111111111111111111' }]
  });
  assert.equal(result.accepted, false);
  assert.equal(result.decision, 'commit_mismatch');
});

test('rejects malformed run identity', () => {
  const result = assessWorkflowObservation({
    ...base,
    query_scope: incompleteScope,
    workflow_runs: [{ id: 0, head_sha: base.commit_sha }]
  });
  assert.equal(result.accepted, false);
  assert.equal(result.decision, 'malformed_workflow_run');
});
