import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyAudibilitySessionBinding } from './verify-audibility-session-binding.mjs';

const validPacket = {
  device: { sessionId: 'bounded-session-1' },
  runtimeEvidence: { sessionId: 'bounded-session-1' },
  humanCheck: { sessionId: 'bounded-session-1' }
};

test('passes when device, runtime, and human evidence share one bounded session', () => {
  const result = verifyAudibilitySessionBinding(validPacket);
  assert.equal(result.status, 'pass');
  assert.equal(result.sessionBound, true);
});

test('fails closed when runtime evidence comes from another session', () => {
  const packet = structuredClone(validPacket);
  packet.runtimeEvidence.sessionId = 'other-session';
  const result = verifyAudibilitySessionBinding(packet);
  assert.ok(result.failures.includes('runtime_session_mismatch'));
});

test('fails closed when human confirmation comes from another session', () => {
  const packet = structuredClone(validPacket);
  packet.humanCheck.sessionId = 'other-session';
  const result = verifyAudibilitySessionBinding(packet);
  assert.ok(result.failures.includes('human_session_mismatch'));
});

test('fails closed when the bounded device session is absent', () => {
  const packet = structuredClone(validPacket);
  delete packet.device.sessionId;
  const result = verifyAudibilitySessionBinding(packet);
  assert.ok(result.failures.includes('missing_device_session'));
});
