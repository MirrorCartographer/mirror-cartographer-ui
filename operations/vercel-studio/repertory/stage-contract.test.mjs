import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStageContract } from './stage-contract.mjs';

const production = {
  hour: 18,
  id: 'hour-18',
  title: 'The Rehearsal Room',
  grammar: 'editable production blocking',
  autoplay: false,
  continuity_channel: 'shared-runtime-state',
  accessibility: ['keyboard-complete', 'screen-reader-labelled', 'reduced-motion-safe'],
};
const schedule = {
  schema_version: 1,
  selection: { fallback: 'hour-00' },
  continuity: { state_channel: 'shared-runtime-state' },
  productions: [production],
};

test('builds a reversible operations-only stage contract', () => {
  const state = { scene: 'opening', revisions: 2 };
  const contract = buildStageContract({ schedule, production, continuityState: state });
  assert.equal(contract.adapter_status, 'operations_preview_only');
  assert.equal(contract.production.id, 'hour-18');
  assert.equal(contract.continuity.state, state);
  assert.equal(contract.media.autoplay, false);
  assert.equal(contract.payments.enabled, false);
  assert.equal(contract.rollback.mode, 'feature-flag-off');
});

test('feature flag changes eligibility without changing safety invariants', () => {
  const contract = buildStageContract({ schedule, production, continuityState: {}, featureFlag: true });
  assert.equal(contract.adapter_status, 'eligible_for_runtime_adapter');
  assert.equal(contract.media.user_gesture_required, true);
  assert.equal(contract.payments.conversion_logic, false);
});

test('rejects continuity forks', () => {
  assert.throws(() => buildStageContract({
    schedule,
    production: { ...production, continuity_channel: 'private-fork' },
    continuityState: {},
  }), /continuity channel/);
});

test('rejects autoplay and missing accessibility declarations', () => {
  assert.throws(() => buildStageContract({
    schedule,
    production: { ...production, autoplay: true },
    continuityState: {},
  }), /autoplay/);
  assert.throws(() => buildStageContract({
    schedule,
    production: { ...production, accessibility: ['keyboard-complete'] },
    continuityState: {},
  }), /screen-reader-labelled/);
});

test('rejects productions outside the schedule and invalid state', () => {
  assert.throws(() => buildStageContract({ schedule, production: { ...production, id: 'hour-99' }, continuityState: {} }), /belong/);
  assert.throws(() => buildStageContract({ schedule, production, continuityState: [] }), /must be an object/);
});
