import test from 'node:test';
import assert from 'node:assert/strict';
import { captureAudioClockSample, sampleAudioClockSession, sampleAndEvaluateAudioClock } from './audio-clock-sampler.mjs';

function clocks() {
  let perf = 1000;
  let contextTime = 1;
  return {
    performanceClock: { now: () => (perf += 50) },
    context: {
      state: 'running', sampleRate: 48000, baseLatency: 0.01, outputLatency: 0.04,
      getOutputTimestamp: () => ({ contextTime: (contextTime += 0.05), performanceTime: perf - 40 })
    }
  };
}

test('captures one standards-shaped output timestamp', () => {
  const { context, performanceClock } = clocks();
  const sample = captureAudioClockSample(context, performanceClock);
  assert.equal(sample.status, 'observed');
  assert.equal(sample.contextTime, 1.05);
  assert.equal(sample.sampledAtPerformanceTime, 1050);
});

test('preserves unavailable getOutputTimestamp as explicit evidence', () => {
  const sample = captureAudioClockSample({}, { now: () => 12 });
  assert.deepEqual(sample, { status: 'unavailable', reason: 'getOutputTimestamp_unavailable', sampledAtPerformanceTime: 12 });
});

test('captures a deterministic session and observed latency', async () => {
  const { context, performanceClock } = clocks();
  const waits = [];
  const packet = await sampleAudioClockSession(context, { performanceClock, sampleCount: 3, intervalMs: 25, sleep: async (ms) => waits.push(ms) });
  assert.equal(packet.captureStatus, 'observed');
  assert.equal(packet.samples.length, 3);
  assert.deepEqual(waits, [25, 25]);
  assert.equal(packet.outputLatency, 0.04);
});

test('uses null instead of inventing zero for unavailable latency', async () => {
  const { context, performanceClock } = clocks();
  delete context.baseLatency;
  context.outputLatency = Number.NaN;
  const packet = await sampleAudioClockSession(context, { performanceClock, sampleCount: 2, sleep: async () => {} });
  assert.equal(packet.baseLatency, null);
  assert.equal(packet.outputLatency, null);
});

test('does not invoke evaluator when output timestamps are unavailable', async () => {
  let called = false;
  const result = await sampleAndEvaluateAudioClock({}, () => { called = true; }, { performanceClock: { now: () => 1 }, sampleCount: 2, sleep: async () => {} });
  assert.equal(called, false);
  assert.equal(result.forwarded, false);
  assert.equal(result.reason, 'getOutputTimestamp_unavailable');
});

test('forwards only evidence classified consistent', async () => {
  const { context, performanceClock } = clocks();
  const consistent = await sampleAndEvaluateAudioClock(context, () => ({ classification: 'consistent' }), { performanceClock, sampleCount: 2, sleep: async () => {} });
  assert.equal(consistent.forwarded, true);

  const second = clocks();
  const contradicted = await sampleAndEvaluateAudioClock(second.context, () => ({ classification: 'contradicted' }), { performanceClock: second.performanceClock, sampleCount: 2, sleep: async () => {} });
  assert.equal(contradicted.forwarded, false);
  assert.equal(contradicted.reason, 'clock_evidence_not_consistent');
});

test('fails closed on malformed timestamps', () => {
  assert.throws(() => captureAudioClockSample({ getOutputTimestamp: () => ({ contextTime: -1, performanceTime: 2 }) }, { now: () => 3 }), /contextTime/);
});
