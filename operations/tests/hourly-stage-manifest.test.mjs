import assert from 'node:assert/strict';
import test from 'node:test';
import { createHourlyStageManifest } from '../tools/hourly-stage-manifest.mjs';

const production = (hour) => ({
  hour, id: `stage-${hour}`, title: `Stage ${hour}`, form: 'spatial field', motion: 'manual reveal', sound: 'silent by default',
  autoplay: false, payment_or_conversion_logic: false, mobile_safe: true, accessible: true, reversible: true,
  continuity_channel: 'continuity-v1',
  provenance: { observed: ['spatial composition'], inferred: ['quiet pacing'], experiment: ['hourly staging'], current_decision: 'Preserve one continuity state.' }
});
const schedule = { time_zone: 'America/New_York', continuity_channel: 'continuity-v1', privacy_boundary: 'Public production grammar only.', productions: Array.from({ length: 24 }, (_, hour) => production(hour)) };
const continuityState = { channel: 'continuity-v1', revision: 'rev-42' };

test('creates a deterministic public-safe manifest for the resolved hour', () => {
  const manifest = createHourlyStageManifest({ schedule, instant: '2026-07-14T04:49:20.000Z', continuityState });
  assert.equal(manifest.resolved_hour, 0);
  assert.equal(manifest.production.id, 'stage-0');
  assert.deepEqual(manifest.continuity, continuityState);
  assert.equal(manifest.production.autoplay, false);
  assert.equal(manifest.provenance.current_decision, 'Preserve one continuity state.');
});

test('fails closed when continuity channels diverge', () => {
  assert.throws(() => createHourlyStageManifest({ schedule, instant: '2026-07-14T04:49:20.000Z', continuityState: { channel: 'other', revision: 'rev-42' } }), /channel mismatch/);
});

test('rejects incomplete provenance', () => {
  const invalid = structuredClone(schedule);
  delete invalid.productions[0].provenance.experiment;
  assert.throws(() => createHourlyStageManifest({ schedule: invalid, instant: '2026-07-14T04:49:20.000Z', continuityState }), /experiment/);
});

test('rejects prohibited private or conversion language', () => {
  const invalid = structuredClone(schedule);
  invalid.productions[0].title = 'Private source token room';
  assert.throws(() => createHourlyStageManifest({ schedule: invalid, instant: '2026-07-14T04:49:20.000Z', continuityState }), /prohibited/);
});
