import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEvidenceObservationWindow } from '../../tools/frontier-research/evidence-observation-window.mjs';

function fixture() {
  return {
    policy: { max_execution_completion_skew_ms: 120000, max_stabilization_gap_ms: 300000 },
    primary: { execution: { completed_at: '2026-07-14T05:00:00.000Z' } },
    independent: { execution: { completed_at: '2026-07-14T05:01:00.000Z' } },
    stabilization: {
      first_snapshot_at: '2026-07-14T05:02:00.000Z',
      second_snapshot_at: '2026-07-14T05:04:00.000Z'
    }
  };
}

test('accepts a bounded post-execution stabilization window', () => {
  const result = validateEvidenceObservationWindow(fixture());
  assert.equal(result.verified, true);
  assert.equal(result.execution_completion_skew_ms, 60000);
  assert.equal(result.stabilization_gap_ms, 120000);
});

test('rejects stabilization that begins before both clients finish', () => {
  const input = fixture();
  input.stabilization.first_snapshot_at = '2026-07-14T05:00:30.000Z';
  assert.equal(validateEvidenceObservationWindow(input).reason, 'stabilization_started_before_all_executions_completed');
});

test('rejects excessive client completion skew', () => {
  const input = fixture();
  input.independent.execution.completed_at = '2026-07-14T05:03:00.001Z';
  assert.equal(validateEvidenceObservationWindow(input).reason, 'execution_completion_skew_exceeded');
});

test('rejects an excessive stabilization gap', () => {
  const input = fixture();
  input.stabilization.second_snapshot_at = '2026-07-14T05:07:00.001Z';
  assert.equal(validateEvidenceObservationWindow(input).reason, 'stabilization_gap_exceeded');
});

test('rejects unbounded or invalid policy windows', () => {
  const input = fixture();
  input.policy.max_stabilization_gap_ms = 3600001;
  assert.equal(validateEvidenceObservationWindow(input).reason, 'policy_window_invalid');
});
