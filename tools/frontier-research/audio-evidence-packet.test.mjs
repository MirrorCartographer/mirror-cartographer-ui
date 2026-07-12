import test from 'node:test';
import assert from 'node:assert/strict';
import { composeAudioEvidencePacket, digestEvidence } from './audio-evidence-packet.mjs';

const sha = 'a'.repeat(40);
const sessionId = 'session-1';
const deploymentId = 'dpl_immutable_1';
const layer = (extra={}) => ({ sessionId, commitSha: sha, deploymentId, ...extra });
const base = () => ({
  commitSha: sha, deploymentId, sessionId,
  activation: layer({ trusted: true }),
  runtime: layer({ state: 'running' }),
  renderTimeline: layer({ advancing: true }),
  route: layer({ classification: 'bound_non_default' }),
  deviceChange: layer({ classification: 'stable' }),
  physical: layer({ outcome: 'heard' })
});

test('supports aligned deployment-bound evidence', () => {
  const result = composeAudioEvidencePacket(base());
  assert.equal(result.classification, 'supported');
  assert.equal(result.claimBoundary.physicalAudibility, 'heard');
  assert.equal(result.contradictions.length, 0);
});

test('preserves rendering/not-heard contradiction', () => {
  const input = base(); input.physical.outcome = 'not_heard';
  const result = composeAudioEvidencePacket(input);
  assert.equal(result.classification, 'contradicted');
  assert.deepEqual(result.contradictions, ['rendering_observed_but_not_heard']);
});

test('keeps untested physical evidence incomplete', () => {
  const input = base(); input.physical.outcome = 'not_tested';
  assert.equal(composeAudioEvidencePacket(input).classification, 'incomplete');
});

test('fails closed on session mismatch', () => {
  const input = base(); input.route.sessionId = 'other';
  assert.throws(() => composeAudioEvidencePacket(input), /route session mismatch/);
});

test('fails closed when render timeline does not advance', () => {
  const input = base(); input.renderTimeline.advancing = false;
  assert.throws(() => composeAudioEvidencePacket(input), /did not advance/);
});

test('preserves device-change without rebind contradiction', () => {
  const input = base(); input.deviceChange = layer({ classification: 'changed', rebound: false });
  const result = composeAudioEvidencePacket(input);
  assert.equal(result.classification, 'contradicted');
  assert.ok(result.contradictions.includes('device_changed_without_confirmed_rebind'));
});

test('digest is deterministic across object key order', () => {
  assert.equal(digestEvidence({ b: 2, a: 1 }), digestEvidence({ a: 1, b: 2 }));
});
