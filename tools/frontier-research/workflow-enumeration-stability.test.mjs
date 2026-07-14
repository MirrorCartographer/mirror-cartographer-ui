import test from 'node:test';
import assert from 'node:assert/strict';
import { assessWorkflowEnumerationStability } from './workflow-enumeration-stability.mjs';

const sha = 'a'.repeat(40);
const run = (overrides = {}) => ({
  id: 11,
  run_attempt: 1,
  head_sha: sha,
  event: 'push',
  status: 'completed',
  conclusion: 'success',
  updated_at: '2026-07-14T12:00:00Z',
  ...overrides
});
const observation = (overrides = {}) => ({
  started_at: '2026-07-14T12:10:00Z',
  completed_at: '2026-07-14T12:10:05Z',
  complete: true,
  provider_ceiling_ambiguous: false,
  runs: [run()],
  ...overrides
});

function input(observations) {
  return { schema_version: 1, commit_sha: sha, minimum_quiet_period_ms: 300000, observations };
}

test('promotes two matching terminal observations after the quiet period', () => {
  const result = assessWorkflowEnumerationStability(input([
    observation(),
    observation({ started_at: '2026-07-14T12:11:00Z', completed_at: '2026-07-14T12:11:05Z' })
  ]));
  assert.equal(result.stable, true);
  assert.equal(result.run_count, 1);
  assert.deepEqual(result.reasons, []);
});

test('fails closed when a later exhaustive observation changes', () => {
  const result = assessWorkflowEnumerationStability(input([
    observation(),
    observation({ started_at: '2026-07-14T12:11:00Z', completed_at: '2026-07-14T12:11:05Z', runs: [run(), run({ id: 12 })] })
  ]));
  assert.equal(result.stable, false);
  assert.ok(result.reasons.includes('enumeration_changed_between_observations'));
});

test('fails closed while a workflow run is nonterminal', () => {
  const pending = run({ status: 'in_progress', conclusion: null });
  const result = assessWorkflowEnumerationStability(input([
    observation({ runs: [pending] }),
    observation({ started_at: '2026-07-14T12:11:00Z', completed_at: '2026-07-14T12:11:05Z', runs: [pending] })
  ]));
  assert.equal(result.stable, false);
  assert.ok(result.reasons.includes('nonterminal_workflow_run_present'));
});

test('fails closed before the configured quiet period', () => {
  const recent = run({ updated_at: '2026-07-14T12:10:30Z' });
  const result = assessWorkflowEnumerationStability(input([
    observation({ runs: [recent] }),
    observation({ started_at: '2026-07-14T12:11:00Z', completed_at: '2026-07-14T12:11:05Z', runs: [recent] })
  ]));
  assert.equal(result.stable, false);
  assert.ok(result.reasons.includes('minimum_quiet_period_not_satisfied'));
});

test('rejects overlapping observations and cross-commit records', () => {
  assert.throws(() => assessWorkflowEnumerationStability(input([
    observation(),
    observation({ started_at: '2026-07-14T12:10:04Z', completed_at: '2026-07-14T12:11:00Z' })
  ])), /observations_overlap_or_reverse/);
  assert.throws(() => assessWorkflowEnumerationStability(input([
    observation(),
    observation({ started_at: '2026-07-14T12:11:00Z', completed_at: '2026-07-14T12:11:05Z', runs: [run({ head_sha: 'b'.repeat(40) })] })
  ])), /cross_commit_run/);
});
