import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compilePublicHourlyStagePayloads } from '../tools/public-hourly-stage-payloads.mjs';
import { selectHourlyStage } from '../prototypes/hourly-stage-runtime-candidate.mjs';

const schedule = JSON.parse(await readFile(new URL('../repertory/hourly-productions.json', import.meta.url), 'utf8'));
const continuityState = Object.freeze({
  channel: schedule.continuity_channel,
  revision: 'test-continuity-revision',
});
const edtHourInstants = Array.from({ length: 24 }, (_, hour) => new Date(Date.UTC(2026, 6, 14, hour + 4)));

function compile(overrides = {}) {
  return compilePublicHourlyStagePayloads({ schedule, continuityState, hourInstants: edtHourInstants, ...overrides });
}

test('compiles the canonical repertory into 24 runtime-ready public payloads', () => {
  const payloads = compile();
  assert.equal(payloads.length, 24);
  assert.deepEqual(payloads.map((payload) => payload.resolved_hour), Array.from({ length: 24 }, (_, hour) => hour));
  assert.equal(new Set(payloads.map((payload) => payload.stage.id)).size, 24);
  assert.deepEqual([...new Set(payloads.map((payload) => payload.continuity.channel))], [schedule.continuity_channel]);

  for (const payload of payloads) {
    assert.equal(payload.controls.autoplay, false);
    assert.equal(payload.controls.sound_requires_user_action, true);
    assert.equal(payload.controls.reduced_motion_supported, true);
    assert.equal(payload.safety.mobile_safe, true);
    assert.equal(payload.safety.accessible, true);
    assert.equal(payload.safety.reversible, true);
    assert.equal(payload.safety.contains_payment_or_conversion_logic, false);
    assert.equal(payload.safety.contains_private_source_material, false);
    assert.deepEqual(Object.keys(payload.provenance).sort(), ['current_decision', 'experiment', 'inferred', 'observed']);
  }
});

test('compiled payloads satisfy the hourly runtime selector', () => {
  const payloads = compile();
  for (let hour = 0; hour < 24; hour += 1) {
    const localDate = new Date(2026, 6, 14, hour, 0, 0);
    assert.equal(selectHourlyStage(payloads, localDate).resolved_hour, hour);
  }
});

test('fails closed when representative instants do not provide exact ordered hour coverage', () => {
  const drifted = [...edtHourInstants];
  drifted[7] = drifted[6];
  assert.throws(() => compile({ hourInstants: drifted }), /resolves to hour 6/);
  assert.throws(() => compile({ hourInstants: edtHourInstants.slice(0, 23) }), /exactly 24/);
});

test('fails closed on continuity drift and prohibited repertory material', () => {
  assert.throws(() => compile({ continuityState: { ...continuityState, channel: 'other-channel' } }), /continuity state channel mismatch/);

  const unsafeSchedule = structuredClone(schedule);
  unsafeSchedule.productions[0].provenance.experiment = ['payment conversion experiment'];
  assert.throws(
    () => compilePublicHourlyStagePayloads({ schedule: unsafeSchedule, continuityState, hourInstants: edtHourInstants }),
    /prohibited private or conversion language/
  );
});
