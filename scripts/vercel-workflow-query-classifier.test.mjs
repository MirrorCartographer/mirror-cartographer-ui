import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyWorkflowQueryResult } from './vercel-workflow-query-classifier.mjs';

const expected = {
  commit_sha: 'abc123',
  workflow_name: 'Vercel Exact Commit Evidence',
  query_scope: 'pull_request_runs_first_page',
  query_limitation: 'connector_does_not_establish_absence_of_non_pr_runs'
};

test('empty result is unobserved, not failed', () => {
  assert.deepEqual(classifyWorkflowQueryResult({ workflow_runs: [] }, expected), {
    observable: false,
    decision: 'hold_unobserved',
    reason: 'no_workflow_runs_returned',
    expected_commit_sha: 'abc123',
    query_scope: 'pull_request_runs_first_page',
    limitation: 'connector_does_not_establish_absence_of_non_pr_runs'
  });
});

test('rejects malformed workflow run collections', () => {
  assert.equal(classifyWorkflowQueryResult({}, expected).decision, 'hold_invalid_query_result');
});

test('holds when returned runs do not match the expected commit', () => {
  const result = classifyWorkflowQueryResult({ workflow_runs: [{ head_sha: 'other' }] }, expected);
  assert.equal(result.decision, 'hold_commit_unobserved');
  assert.deepEqual(result.observed_head_shas, ['other']);
});

test('selects the newest matching run', () => {
  const result = classifyWorkflowQueryResult({ workflow_runs: [
    { id: 1, head_sha: 'abc123', name: expected.workflow_name, updated_at: '2026-07-12T19:00:00Z' },
    { id: 2, head_sha: 'abc123', name: expected.workflow_name, updated_at: '2026-07-12T19:10:00Z' }
  ] }, expected);
  assert.equal(result.decision, 'inspect_workflow_run');
  assert.equal(result.run.id, 2);
});

test('fails closed on wrong workflow identity', () => {
  const result = classifyWorkflowQueryResult({ workflow_runs: [
    { id: 3, head_sha: 'abc123', name: 'Other Workflow', updated_at: '2026-07-12T19:10:00Z' }
  ] }, expected);
  assert.equal(result.decision, 'hold_wrong_workflow');
});
