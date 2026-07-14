import test from 'node:test';
import assert from 'node:assert/strict';
import { createPublicHourlyStagePayload, serializePublicHourlyStagePayload } from '../tools/public-hourly-stage-adapter.mjs';

const manifest = {
  resolved_hour: 0,
  time_zone: 'America/New_York',
  production: {
    id: 'midnight-coordinate-room',
    title: 'Midnight Coordinate Room',
    form: 'spatial title field',
    motion: 'slow orbital coordinates',
    sound: 'manual ambient tone only',
    autoplay: false,
    mobile_safe: true,
    accessible: true,
    reversible: true
  },
  continuity: {
    channel: 'mirror-cartographer-continuity-v1',
    revision: 'internal-revision-not-for-public-payload'
  },
  provenance: {
    observed: ['spatial composition'],
    inferred: ['quiet nocturnal pacing'],
    experiment: ['coordinates orbit a stable center'],
    current_decision: 'Open the daily cycle with orientation rather than explanation.'
  }
};

test('produces an allowlisted public payload while preserving continuity channel', () => {
  const payload = createPublicHourlyStagePayload(manifest);
  assert.equal(payload.stage.title, 'Midnight Coordinate Room');
  assert.equal(payload.continuity.channel, 'mirror-cartographer-continuity-v1');
  assert.equal(payload.controls.autoplay, false);
  assert.equal(payload.controls.sound_requires_user_action, true);
  assert.equal(payload.safety.contains_private_source_material, false);
  assert.equal(payload.safety.contains_payment_or_conversion_logic, false);
  assert.equal('revision' in payload.continuity, false);
  assert.equal('privacy_boundary' in payload, false);
});

test('serializes deterministically with a trailing newline', () => {
  const first = serializePublicHourlyStagePayload(manifest);
  const second = serializePublicHourlyStagePayload(structuredClone(manifest));
  assert.equal(first, second);
  assert.equal(first.endsWith('\n'), true);
});

test('fails closed when autoplay or safety declarations regress', () => {
  assert.throws(() => createPublicHourlyStagePayload({
    ...manifest,
    production: { ...manifest.production, autoplay: true }
  }), /non-autoplaying/);
  assert.throws(() => createPublicHourlyStagePayload({
    ...manifest,
    production: { ...manifest.production, mobile_safe: false }
  }), /mobile_safe=true/);
});

test('fails closed on prohibited language and invalid hour selection', () => {
  assert.throws(() => createPublicHourlyStagePayload({
    ...manifest,
    production: { ...manifest.production, title: 'Private credential room' }
  }), /prohibited language/);
  assert.throws(() => createPublicHourlyStagePayload({ ...manifest, resolved_hour: 24 }), /0 through 23/);
});
