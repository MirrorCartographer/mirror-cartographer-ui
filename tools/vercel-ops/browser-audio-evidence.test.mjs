import test from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserAudioEvidence } from './browser-audio-evidence.mjs';

const randomBytes = () => new Uint8Array(18).fill(7);
const identity = {
  commit_sha: 'a'.repeat(40),
  deployment_id: 'dpl_immutable_12345',
  device_class: 'physical_iphone'
};

function clock() {
  const values = [
    '2026-07-12T12:48:00.000Z',
    '2026-07-12T12:48:01.000Z',
    '2026-07-12T12:48:02.000Z'
  ];
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

function context({ latency = true, advancing = true } = {}) {
  let index = 0;
  const values = advancing
    ? [
        { contextTime: 1, performanceTime: 1000 },
        { contextTime: 1.1, performanceTime: 1100 }
      ]
    : [
        { contextTime: 1, performanceTime: 1000 },
        { contextTime: 1, performanceTime: 1000 }
      ];
  return {
    state: 'running',
    currentTime: 1.2,
    getOutputTimestamp() {
      return values[Math.min(index++, values.length - 1)];
    },
    ...(latency ? { outputLatency: 0.05 } : {})
  };
}

function performanceClock() {
  let index = 0;
  return { now: () => [1002, 1102][Math.min(index++, 1)] };
}

function build(audioContext, audible = true) {
  const evidence = createBrowserAudioEvidence({
    navigatorRef: { userActivation: { isActive: true } },
    now: clock(),
    randomBytes
  });
  evidence
    .captureActivation()
    .captureRuntime(audioContext, { source_started: true, destination_connected: true })
    .captureOutputSample(performanceClock())
    .captureOutputSample(performanceClock())
    .captureHumanOutcome(audible);
  return evidence;
}

test('combines human attestation and advancing output timeline', () => {
  const result = build(context()).finalize(identity, { now: '2026-07-12T12:48:03.000Z' });
  assert.equal(result.valid, true);
  assert.equal(result.attestation.binding.classification, 'human_confirmed');
  assert.equal(result.render_timeline.classification, 'render_timeline_observed');
});

test('supports Safari-shaped contexts without outputLatency', () => {
  const result = build(context({ latency: false })).finalize(identity, { now: '2026-07-12T12:48:03.000Z' });
  assert.equal(result.valid, true);
  assert.equal(result.render_timeline.output_latency_s, null);
});

test('fails closed when output timeline does not advance', () => {
  const result = build(context({ advancing: false })).finalize(identity, { now: '2026-07-12T12:48:03.000Z' });
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'output_timeline_not_advancing');
});

test('preserves contradicted human outcome beside valid render evidence', () => {
  const result = build(context(), false).finalize(identity, { now: '2026-07-12T12:48:03.000Z' });
  assert.equal(result.valid, true);
  assert.equal(result.contradiction_preserved, true);
  assert.equal(result.attestation.binding.classification, 'contradicted');
});

test('rejects sampling before runtime capture', () => {
  const evidence = createBrowserAudioEvidence({
    navigatorRef: { userActivation: { isActive: true } },
    now: clock(),
    randomBytes
  });
  assert.throws(() => evidence.captureOutputSample(performanceClock()), /runtime_required/);
});
