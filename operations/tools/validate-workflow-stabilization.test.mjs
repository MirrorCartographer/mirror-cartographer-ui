import assert from 'node:assert/strict';
import { assessWorkflowStabilization } from './validate-workflow-stabilization.mjs';

const sha = 'a'.repeat(40);
const snap = (at, runs = [{ id: 1, head_sha: sha, status: 'completed', conclusion: 'success', event: 'push' }]) => ({
  complete: true,
  commit_sha: sha,
  retrieved_at: at,
  runs
});

let passed = 0;
const ok = (fn) => { fn(); passed += 1; };
const bad = (code, fn) => { assert.throws(fn, new RegExp(code)); passed += 1; };

ok(() => assert.equal(assessWorkflowStabilization({
  first: snap('2026-07-13T22:00:00Z'),
  second: snap('2026-07-13T22:02:00Z')
}).verified, true));
bad('quiet_period_insufficient', () => assessWorkflowStabilization({
  first: snap('2026-07-13T22:00:00Z'),
  second: snap('2026-07-13T22:00:30Z')
}));
bad('workflow_set_not_stable', () => assessWorkflowStabilization({
  first: snap('2026-07-13T22:00:00Z'),
  second: snap('2026-07-13T22:02:00Z', [{ id: 2, head_sha: sha, status: 'completed' }])
}));
bad('first_nonterminal_run', () => assessWorkflowStabilization({
  first: snap('2026-07-13T22:00:00Z', [{ id: 1, head_sha: sha, status: 'in_progress' }]),
  second: snap('2026-07-13T22:02:00Z')
}));
bad('second_incomplete', () => assessWorkflowStabilization({
  first: snap('2026-07-13T22:00:00Z'),
  second: { ...snap('2026-07-13T22:02:00Z'), complete: false }
}));
bad('commit_mismatch', () => assessWorkflowStabilization({
  first: snap('2026-07-13T22:00:00Z'),
  second: { ...snap('2026-07-13T22:02:00Z'), commit_sha: 'b'.repeat(40), runs: [] }
}));
bad('first_duplicate_run_id', () => assessWorkflowStabilization({
  first: snap('2026-07-13T22:00:00Z', [
    { id: 1, head_sha: sha, status: 'completed' },
    { id: 1, head_sha: sha, status: 'completed' }
  ]),
  second: snap('2026-07-13T22:02:00Z')
}));

console.log(JSON.stringify({ passed, failed: 0 }));
