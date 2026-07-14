import test from 'node:test';
import assert from 'node:assert/strict';
import {
  installHourlyStageRuntime,
  selectHourlyStage,
  validatePublicStagePayload,
} from '../prototypes/hourly-stage-runtime-candidate.mjs';

const payload = (hour) => ({
  schema_version: 1,
  resolved_hour: hour,
  stage: { id: `stage-${hour}`, title: `Stage ${hour}`, form: 'film', motion: 'user-paced', sound: 'silent until invited' },
  controls: { autoplay: false, sound_requires_user_action: true, reduced_motion_supported: true },
  continuity: { channel: 'mirror-cartographer-continuity-v1' },
  safety: {
    mobile_safe: true,
    accessible: true,
    reversible: true,
    contains_payment_or_conversion_logic: false,
    contains_private_source_material: false,
  },
});
const repertory = Array.from({ length: 24 }, (_, hour) => payload(hour));

test('selects the deterministic local-hour production', () => {
  assert.equal(selectHourlyStage(repertory, new Date(2026, 6, 14, 17)).stage.id, 'stage-17');
});

test('fails closed on repertory gaps and hour mismatch', () => {
  assert.throws(() => selectHourlyStage(repertory.slice(0, 23), new Date()), /exactly 24/);
  const invalid = [...repertory];
  invalid[3] = payload(4);
  assert.throws(() => selectHourlyStage(invalid, new Date(2026, 6, 14, 3)), /does not match/);
});

test('rejects autoplay, conversion, and private-source payloads', () => {
  for (const mutation of [
    (p) => { p.controls.autoplay = true; },
    (p) => { p.safety.contains_payment_or_conversion_logic = true; },
    (p) => { p.safety.contains_private_source_material = true; },
  ]) {
    const candidate = structuredClone(payload(2));
    mutation(candidate);
    assert.throws(() => validatePublicStagePayload(candidate));
  }
});

test('feature flag is inert and installation is reversible', () => {
  const root = { dataset: {} };
  const events = [];
  class CustomEvent { constructor(type, options) { this.type = type; this.detail = options.detail; } }
  const fakeWindow = {
    CustomEvent,
    dispatchEvent(event) { events.push(event); },
    matchMedia() { return { matches: true }; },
  };
  const disabled = installHourlyStageRuntime({ enabled: false });
  assert.deepEqual(disabled, { installed: false, reason: 'feature_disabled' });

  const installed = installHourlyStageRuntime({
    enabled: true,
    publicPayloads: repertory,
    window: fakeWindow,
    document: { documentElement: root },
    now: () => new Date(2026, 6, 14, 9),
  });
  assert.equal(root.dataset.mcStageId, 'stage-9');
  assert.equal(root.dataset.mcReducedMotion, 'reduce');
  assert.equal(events.length, 1);
  installed.rollback();
  assert.deepEqual(root.dataset, {});
});
