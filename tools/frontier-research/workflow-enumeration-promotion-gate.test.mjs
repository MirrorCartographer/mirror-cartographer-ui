import test from 'node:test';
import assert from 'node:assert/strict';
import { assessWorkflowEnumerationPromotion } from './workflow-enumeration-promotion-gate.mjs';

const sha = 'a'.repeat(40);
const run = {
  id: 1,
  head_sha: sha,
  event: 'push',
  status: 'completed',
  conclusion: 'success',
  workflow_id: 2,
  run_attempt: 1,
  updated_at: '2026-07-14T12:00:00Z'
};

const observation = (started_at, completed_at, runs = [run]) => ({
  started_at,
  completed_at,
  primary: { complete: true, commitSha: sha, runs },
  independent: { complete: true, commitSha: sha, runs: structuredClone(runs) }
});

test('promotes only after reconciliation and stability', () => {
  const result = assessWorkflowEnumerationPromotion({
    schema_version: 1,
    commit_sha: sha,
    minimum_quiet_period_ms: 60000,
    observations: [
      observation('2026-07-14T12:01:00Z', '2026-07-14T12:02:00Z'),
      observation('2026-07-14T12:03:00Z', '2026-07-14T12:04:00Z')
    ]
  });
  assert.equal(result.promotable, true);
});

test('fails before stability when clients diverge', () => {
  const first = observation('2026-07-14T12:01:00Z', '2026-07-14T12:02:00Z');
  first.independent.runs = [];
  const result = assessWorkflowEnumerationPromotion({
    schema_version: 1,
    commit_sha: sha,
    observations: [first, observation('2026-07-14T12:03:00Z', '2026-07-14T12:04:00Z')]
  });
  assert.equal(result.promotable, false);
  assert.equal(result.reason, 'observation_0_reconciliation_failed');
});

test('fails when reconciled observations drift', () => {
  const changed = { ...run, id: 2 };
  const result = assessWorkflowEnumerationPromotion({
    schema_version: 1,
    commit_sha: sha,
    observations: [
      observation('2026-07-14T12:01:00Z', '2026-07-14T12:02:00Z'),
      observation('2026-07-14T12:03:00Z', '2026-07-14T12:04:00Z', [run, changed])
    ]
  });
  assert.equal(result.promotable, false);
  assert.deepEqual(result.stability.reasons, ['enumeration_changed_between_observations']);
});
