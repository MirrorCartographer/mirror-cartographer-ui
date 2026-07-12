import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkflowQueryReceipt } from './vercel-workflow-query-receipt.mjs';

const base = {
  repository: 'MirrorCartographer/mirror-cartographer-ui',
  commit_sha: '00c96b0409c4540f6c6e1bf510974296c08b2463',
  queried_at: '2026-07-12T20:04:52-04:00'
};

test('records an empty exact-commit query without claiming execution', () => {
  const result = createWorkflowQueryReceipt({ ...base, workflow_runs: [] });
  assert.equal(result.accepted, true);
  assert.equal(result.observable, false);
  assert.equal(result.decision, 'no_workflow_runs_observed');
});

test('accepts runs bound to the exact queried commit', () => {
  const result = createWorkflowQueryReceipt({
    ...base,
    workflow_runs: [{ id: 42, head_sha: base.commit_sha, name: 'Evidence', status: 'completed', conclusion: 'success' }]
  });
  assert.equal(result.accepted, true);
  assert.equal(result.observable, true);
  assert.equal(result.workflow_runs[0].id, 42);
});

test('rejects a run from a different commit', () => {
  const result = createWorkflowQueryReceipt({
    ...base,
    workflow_runs: [{ id: 43, head_sha: '1111111111111111111111111111111111111111' }]
  });
  assert.equal(result.accepted, false);
  assert.equal(result.decision, 'commit_mismatch');
});

test('rejects mutable or malformed commit identity', () => {
  const result = createWorkflowQueryReceipt({ ...base, commit_sha: 'main', workflow_runs: [] });
  assert.equal(result.accepted, false);
  assert.equal(result.decision, 'invalid_commit_sha');
});

test('rejects malformed workflow runs', () => {
  const result = createWorkflowQueryReceipt({ ...base, workflow_runs: [{ id: 0, head_sha: base.commit_sha }] });
  assert.equal(result.accepted, false);
  assert.equal(result.decision, 'malformed_workflow_run');
});
