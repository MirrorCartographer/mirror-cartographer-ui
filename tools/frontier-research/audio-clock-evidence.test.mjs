import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAudioClockEvidence } from './audio-clock-evidence.mjs';

const consistent = {
  baseLatency: 0.01,
  outputLatency: 0.04,
  samples: [
    { contextTime: 1, performanceTime: 1000, sampledAtPerformanceTime: 1045 },
    { contextTime: 1.1, performanceTime: 1101, sampledAtPerformanceTime: 1146 },
    { contextTime: 1.2, performanceTime: 1200, sampledAtPerformanceTime: 1245 }
  ]
};

test('accepts monotonic, closely aligned clocks', () => {
  const result = evaluateAudioClockEvidence(consistent);
  assert.equal(result.classification, 'consistent');
  assert.deepEqual(result.violations, []);
  assert.equal(result.latency.outputLatency.status, 'observed');
});

test('preserves unobservable latency instead of inventing zero', () => {
  const result = evaluateAudioClockEvidence({ samples: consistent.samples });
  assert.equal(result.latency.baseLatency.status, 'unobservable');
  assert.equal(result.latency.outputLatency.status, 'unobservable');
});

test('rejects a regressing context clock', () => {
  const input = structuredClone(consistent);
  input.samples[2].contextTime = 1.05;
  const result = evaluateAudioClockEvidence(input);
  assert.equal(result.classification, 'contradicted');
  assert.ok(result.violations.some((item) => item.code === 'context_time_regressed'));
});

test('detects excessive divergence between audio and performance clocks', () => {
  const input = structuredClone(consistent);
  input.samples[2].performanceTime = 1300;
  const result = evaluateAudioClockEvidence(input, { maxDriftMs: 20 });
  assert.ok(result.violations.some((item) => item.code === 'clock_delta_drift_exceeded'));
});

test('detects an output timestamp implausibly in the future', () => {
  const input = structuredClone(consistent);
  input.samples[1].performanceTime = 1200;
  input.samples[1].sampledAtPerformanceTime = 1100;
  const result = evaluateAudioClockEvidence(input);
  assert.ok(result.violations.some((item) => item.code === 'output_timestamp_in_future'));
});

test('digest is deterministic across object key order', () => {
  const a = evaluateAudioClockEvidence(consistent);
  const reordered = { samples: consistent.samples, outputLatency: 0.04, baseLatency: 0.01 };
  const b = evaluateAudioClockEvidence(reordered);
  assert.equal(a.evidenceDigest, b.evidenceDigest);
});

test('fails closed on too few samples', () => {
  assert.throws(() => evaluateAudioClockEvidence({ samples: [consistent.samples[0]] }), /at least two samples/);
});
