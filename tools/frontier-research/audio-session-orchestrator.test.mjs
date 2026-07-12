import test from 'node:test';
import assert from 'node:assert/strict';
import { runAudioEvidenceSession } from './audio-session-orchestrator.mjs';

const identity = {
  sessionId: 'session-1',
  commitSha: 'a'.repeat(40),
  deploymentId: 'dpl_123'
};

function layers(overrides = {}) {
  return {
    activation: { trusted: true },
    runtime: { state: 'running' },
    renderTimeline: { advancing: true },
    route: { classification: 'default_only' },
    deviceChange: { classification: 'stable' },
    physical: { outcome: 'not_tested' },
    ...overrides
  };
}

function observedContext() {
  let n = 0;
  return {
    state: 'running',
    sampleRate: 48000,
    baseLatency: 0.01,
    outputLatency: 0.02,
    getOutputTimestamp() {
      const current = n++;
      return { contextTime: current * 0.05, performanceTime: current * 50 };
    }
  };
}

const samplerOptions = {
  sampleCount: 3,
  intervalMs: 0,
  sleep: async () => {},
  performanceClock: { now: (() => { let n = 0; return () => n++ * 50; })() }
};

test('composes one identity-bound evidence session', async () => {
  const result = await runAudioEvidenceSession({
    ...identity,
    context: observedContext(),
    samplerOptions,
    ...layers()
  });
  assert.equal(result.status, 'composed');
  assert.equal(result.rawCapture.sessionId, identity.sessionId);
  assert.equal(result.clockEvaluation.classification, 'consistent');
  assert.deepEqual(result.packet.identity, identity);
  assert.equal(result.packet.classification, 'incomplete');
});

test('fails closed when getOutputTimestamp is unavailable', async () => {
  const result = await runAudioEvidenceSession({
    ...identity,
    context: { state: 'running', sampleRate: 48000 },
    samplerOptions,
    ...layers()
  });
  assert.equal(result.status, 'incomplete');
  assert.equal(result.reason, 'getOutputTimestamp_unavailable');
  assert.equal(result.packet, null);
});

test('fails closed when clock evaluation is contradicted', async () => {
  const result = await runAudioEvidenceSession({
    ...identity,
    context: observedContext(),
    samplerOptions,
    ...layers()
  }, {
    evaluateAudioClock: () => ({ classification: 'contradicted', violations: [{ code: 'test' }] })
  });
  assert.equal(result.status, 'incomplete');
  assert.equal(result.reason, 'clock_evidence_not_consistent');
  assert.equal(result.packet, null);
});

test('rejects layer identity mismatch before composition', async () => {
  await assert.rejects(() => runAudioEvidenceSession({
    ...identity,
    context: observedContext(),
    samplerOptions,
    ...layers({ route: { classification: 'default_only', sessionId: 'other' } })
  }), /route sessionId mismatch/);
});

test('preserves physical not-heard contradiction in composed packet', async () => {
  const result = await runAudioEvidenceSession({
    ...identity,
    context: observedContext(),
    samplerOptions,
    ...layers({ physical: { outcome: 'not_heard' } })
  });
  assert.equal(result.status, 'composed');
  assert.equal(result.packet.classification, 'contradicted');
  assert.ok(result.packet.contradictions.includes('rendering_observed_but_not_heard'));
});

test('rejects invalid commit identity', async () => {
  await assert.rejects(() => runAudioEvidenceSession({
    ...identity,
    commitSha: 'bad',
    context: observedContext(),
    samplerOptions,
    ...layers()
  }), /40-character git SHA/);
});
