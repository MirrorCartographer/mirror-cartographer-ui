import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateWorkflowObservation } from './vercel-workflow-observation-gate.mjs';

const expected = { commit_sha: 'abc123', workflow_name: 'V-001 Exact Commit Evidence' };
const good = {
  observed_at: '2026-07-12T19:17:00Z', head_sha: 'abc123', workflow_name: 'V-001 Exact Commit Evidence',
  status: 'completed', conclusion: 'success', run_id: 42, run_attempt: 1,
  html_url: 'https://github.com/example/repo/actions/runs/42',
  artifacts: ['vercel-audio-route-capability', 'vercel-exact-commit-manifest']
};

test('accepts exact commit successful run with required artifacts', () => {
  assert.equal(evaluateWorkflowObservation(good, expected).accepted, true);
});
test('rejects another commit', () => {
  assert.equal(evaluateWorkflowObservation({...good, head_sha: 'def456'}, expected).decision, 'hold_commit_mismatch');
});
test('holds incomplete runs', () => {
  assert.equal(evaluateWorkflowObservation({...good, status: 'in_progress', conclusion: null}, expected).decision, 'hold_for_final_status');
});
test('rejects missing retained evidence', () => {
  const result = evaluateWorkflowObservation({...good, artifacts: ['vercel-exact-commit-manifest']}, expected);
  assert.deepEqual(result.missing_artifacts, ['vercel-audio-route-capability']);
});
test('rejects success without immutable run identity', () => {
  assert.equal(evaluateWorkflowObservation({...good, html_url: null}, expected).decision, 'hold_unbound_run');
});
