import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyPhysicalAudibilityEvidence } from './verify-physical-audibility-evidence.mjs';

const commit = 'a'.repeat(40);
const validPacket = {
  applicationCommit: commit,
  testedCommit: commit,
  testedAt: '2026-07-12T05:01:00Z',
  deployment: {
    sourceCommit: commit,
    immutable: true,
    status: 'ready',
    url: 'https://mirror-cartographer-ui-a1b2c3d4e.vercel.app/',
    readyAt: '2026-07-12T05:00:00Z'
  },
  device: { platform: 'iPhone', browser: 'Safari', audioRoute: 'built-in-speaker', volumeState: 'audible-nonzero', sessionId: 'bounded-session-1' },
  humanCheck: { observedAt: '2026-07-12T05:02:00Z', sessionId: 'bounded-session-1' },
  runtimeEvidence: { sessionId: 'bounded-session-1', audioContextSupported: true, userActivationObserved: true, resumeFulfilled: true, contextStateAfter: 'running', sourceStarted: true, destinationConnected: true, signalObserved: true, humanReportedAudible: true }
};

test('passes exact-commit immutable Vercel deployment plus session-bound human confirmation', () => {
  const result = verifyPhysicalAudibilityEvidence(validPacket);
  assert.equal(result.status, 'pass');
  assert.equal(result.schemaVersion, '1.3.0');
  assert.equal(result.sessionBinding.sessionBound, true);
});

test('fails closed for machine signal without human confirmation', () => {
  const packet = structuredClone(validPacket);
  delete packet.humanCheck;
  packet.runtimeEvidence.humanReportedAudible = undefined;
  const result = verifyPhysicalAudibilityEvidence(packet);
  assert.ok(result.failures.includes('audibility_signal_observed'));
});

test('preserves contradiction when signal exists but human reports silence', () => {
  const packet = structuredClone(validPacket);
  packet.runtimeEvidence.humanReportedAudible = false;
  const result = verifyPhysicalAudibilityEvidence(packet);
  assert.equal(result.runtime.state, 'contradicted');
});

test('rejects deployment or tested commit drift', () => {
  const packet = structuredClone(validPacket);
  packet.deployment.sourceCommit = 'b'.repeat(40);
  packet.testedCommit = 'c'.repeat(40);
  const result = verifyPhysicalAudibilityEvidence(packet);
  assert.ok(result.failures.includes('deployment_commit_mismatch'));
  assert.ok(result.failures.includes('tested_commit_mismatch'));
});

test('rejects mutable aliases, lookalikes, and decorated deployment URLs', () => {
  for (const url of [
    'https://mirror-cartographer-ui.vercel.app/',
    'https://mirror-cartographer-ui-a1b2c3d4e.vercel.app/path',
    'https://mirror-cartographer-ui-a1b2c3d4e.vercel.app/?x=1',
    'https://mirror-cartographer-ui-a1b2c3d4e.vercel.app.evil.example/'
  ]) {
    const packet = structuredClone(validPacket);
    packet.deployment.url = url;
    assert.ok(verifyPhysicalAudibilityEvidence(packet).failures.includes('invalid_immutable_vercel_url'));
  }
});

test('rejects missing or malformed deployment and test timestamps', () => {
  const packet = structuredClone(validPacket);
  packet.deployment.readyAt = 'not-a-time';
  delete packet.testedAt;
  const result = verifyPhysicalAudibilityEvidence(packet);
  assert.ok(result.failures.includes('invalid_deployment_ready_time'));
  assert.ok(result.failures.includes('invalid_tested_time'));
});

test('rejects a bounded test recorded before the deployment became ready', () => {
  const packet = structuredClone(validPacket);
  packet.testedAt = '2026-07-12T04:59:59Z';
  packet.humanCheck.observedAt = '2026-07-12T05:02:00Z';
  const result = verifyPhysicalAudibilityEvidence(packet);
  assert.ok(result.failures.includes('test_precedes_deployment_ready'));
});

test('rejects human confirmation recorded before the bounded test', () => {
  const packet = structuredClone(validPacket);
  packet.humanCheck.observedAt = '2026-07-12T04:59:00Z';
  const result = verifyPhysicalAudibilityEvidence(packet);
  assert.ok(result.failures.includes('human_observation_precedes_test'));
});

test('rejects unbounded device evidence', () => {
  const packet = structuredClone(validPacket);
  packet.device.audioRoute = '';
  packet.device.volumeState = '';
  const result = verifyPhysicalAudibilityEvidence(packet);
  assert.ok(result.failures.includes('missing_device_audioRoute'));
  assert.ok(result.failures.includes('missing_device_volumeState'));
});

test('rejects runtime evidence from a different physical test session', () => {
  const packet = structuredClone(validPacket);
  packet.runtimeEvidence.sessionId = 'other-session';
  const result = verifyPhysicalAudibilityEvidence(packet);
  assert.ok(result.failures.includes('runtime_session_mismatch'));
  assert.equal(result.supportsPhysicalAudibilityClaim, false);
});

test('rejects human confirmation from a different physical test session', () => {
  const packet = structuredClone(validPacket);
  packet.humanCheck.sessionId = 'other-session';
  const result = verifyPhysicalAudibilityEvidence(packet);
  assert.ok(result.failures.includes('human_session_mismatch'));
  assert.equal(result.supportsPhysicalAudibilityClaim, false);
});
