import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserAudioObservation } from './browser-audio-observation.mjs';

const times = [
  '2026-07-12T11:38:00.000Z',
  '2026-07-12T11:38:01.000Z',
  '2026-07-12T11:38:02.000Z'
];
const identity = {
  commit_sha: 'a'.repeat(40),
  deployment_id: 'dpl_immutable_12345',
  device_class: 'physical_iphone'
};
const randomBytes = () => new Uint8Array(18).fill(7);

function clock(values = times) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

test('captures a valid human-confirmed browser audio observation', () => {
  const observation = createBrowserAudioObservation({
    navigatorRef: { userActivation: { isActive: true } },
    now: clock(),
    randomBytes
  });

  const result = observation
    .captureActivation()
    .captureRuntime({ state: 'running' }, { source_started: true, destination_connected: true })
    .captureHumanOutcome(true)
    .finalize(identity, { now: '2026-07-12T11:38:03.000Z' });

  assert.equal(result.valid, true);
  assert.equal(result.binding.classification, 'human_confirmed');
});

test('rejects capture without active transient user activation', () => {
  const observation = createBrowserAudioObservation({
    navigatorRef: { userActivation: { isActive: false } },
    now: clock(),
    randomBytes
  });
  assert.throws(() => observation.captureActivation(), /transient_user_activation_required/);
});

test('rejects runtime capture before activation', () => {
  const observation = createBrowserAudioObservation({ now: clock(), randomBytes });
  assert.throws(
    () => observation.captureRuntime({ state: 'running' }, { source_started: true, destination_connected: true }),
    /activation_required/
  );
});

test('rejects missing AudioContext object', () => {
  const observation = createBrowserAudioObservation({
    navigatorRef: { userActivation: { isActive: true } },
    now: clock(),
    randomBytes
  }).captureActivation();
  assert.throws(() => observation.captureRuntime(null), /audio_context_required/);
});

test('preserves contradicted human outcome', () => {
  const observation = createBrowserAudioObservation({
    navigatorRef: { userActivation: { isActive: true } },
    now: clock(),
    randomBytes
  });

  const result = observation
    .captureActivation()
    .captureRuntime({ state: 'running' }, { source_started: true, destination_connected: true })
    .captureHumanOutcome(false)
    .finalize(identity, { now: '2026-07-12T11:38:03.000Z' });

  assert.equal(result.valid, true);
  assert.equal(result.binding.classification, 'contradicted');
});

test('fails closed when route evidence is incomplete', () => {
  const observation = createBrowserAudioObservation({
    navigatorRef: { userActivation: { isActive: true } },
    now: clock(),
    randomBytes
  });

  const result = observation
    .captureActivation()
    .captureRuntime({ state: 'running' }, { source_started: true, destination_connected: false })
    .captureHumanOutcome(true)
    .finalize(identity, { now: '2026-07-12T11:38:03.000Z' });

  assert.equal(result.valid, false);
  assert.equal(result.reason, 'runtime_route_incomplete');
});
