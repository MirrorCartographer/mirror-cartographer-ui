import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAudioOutputTimeline } from './audio-output-timeline.mjs';

const base = {
  commit_sha: 'a'.repeat(40),
  deployment_id: 'dpl_example_123456',
  session_id: 'session_1234567890',
  audio_context_state: 'running',
  samples: [
    { context_time_s: 1.0, performance_time_ms: 1000, current_time_s: 1.02, captured_at_performance_ms: 1100 },
    { context_time_s: 1.1, performance_time_ms: 1100, current_time_s: 1.12, captured_at_performance_ms: 1200 }
  ]
};

test('accepts a Safari-compatible timeline without outputLatency', () => {
  const result = validateAudioOutputTimeline(base);
  assert.equal(result.valid, true);
  assert.equal(result.classification, 'render_timeline_observed');
  assert.equal(result.output_latency_s, null);
  assert.equal(result.estimated_acoustic_time_ms, null);
});

test('estimates acoustic output time only when outputLatency exists', () => {
  const result = validateAudioOutputTimeline({ ...base, output_latency_s: 0.08 });
  assert.equal(result.valid, true);
  assert.equal(result.estimated_acoustic_time_ms, 1180);
});

test('rejects zero timestamps before rendering starts', () => {
  const input = structuredClone(base);
  input.samples[0].context_time_s = 0;
  input.samples[0].performance_time_ms = 0;
  assert.equal(validateAudioOutputTimeline(input).reason, 'rendering_not_started');
});

test('rejects a non-advancing render timeline', () => {
  const input = structuredClone(base);
  input.samples[1].context_time_s = input.samples[0].context_time_s;
  assert.equal(validateAudioOutputTimeline(input).reason, 'output_timeline_not_advancing');
});

test('rejects incoherent performance-clock capture', () => {
  const input = structuredClone(base);
  input.samples[1].captured_at_performance_ms = 2000;
  assert.equal(validateAudioOutputTimeline(input).reason, 'performance_clock_incoherent');
});

test('rejects currentTime that does not exceed contextTime', () => {
  const input = structuredClone(base);
  input.samples[1].current_time_s = input.samples[1].context_time_s;
  assert.equal(validateAudioOutputTimeline(input).reason, 'invalid_current_time_relation');
});
