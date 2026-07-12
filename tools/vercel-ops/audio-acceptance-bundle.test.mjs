import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAudioAcceptanceBundle } from './audio-acceptance-bundle.mjs';

const identity = { commit_sha: 'a'.repeat(40), deployment_id: 'dpl_123', deployment_url: 'https://example.vercel.app' };
const browser = {
  ...identity,
  valid: true,
  contradiction_preserved: false,
  attestation: { binding: { classification: 'accepted' } }
};
const physical = { ...identity, valid: true, accepted: true, classification: 'accepted' };

test('accepts aligned browser and physical evidence', () => {
  const result = evaluateAudioAcceptanceBundle({ identity, browser_evidence: browser, physical_verification: physical });
  assert.equal(result.outcome, 'accepted');
  assert.equal(result.accepted, true);
});

test('preserves contradiction', () => {
  const result = evaluateAudioAcceptanceBundle({ identity, browser_evidence: { ...browser, contradiction_preserved: true }, physical_verification: physical });
  assert.equal(result.outcome, 'contradicted');
  assert.equal(result.contradiction_preserved, true);
});

test('rejects negative bounded physical result', () => {
  const result = evaluateAudioAcceptanceBundle({ identity, browser_evidence: browser, physical_verification: { ...physical, accepted: false, classification: 'rejected' } });
  assert.equal(result.outcome, 'rejected');
});

test('reports incomplete when an evidence channel is missing', () => {
  const result = evaluateAudioAcceptanceBundle({ identity, browser_evidence: browser });
  assert.equal(result.outcome, 'incomplete');
});

test('fails closed on identity mismatch', () => {
  const result = evaluateAudioAcceptanceBundle({ identity, browser_evidence: { ...browser, deployment_id: 'dpl_other' }, physical_verification: physical });
  assert.equal(result.outcome, 'identity_mismatch');
  assert.equal(result.valid, false);
});

test('fails closed on malformed identity', () => {
  const result = evaluateAudioAcceptanceBundle({ identity: {}, browser_evidence: browser, physical_verification: physical });
  assert.equal(result.outcome, 'invalid');
  assert.ok(result.failures.includes('commit_sha_invalid'));
});

test('digest is deterministic', () => {
  const first = evaluateAudioAcceptanceBundle({ identity, browser_evidence: browser, physical_verification: physical });
  const second = evaluateAudioAcceptanceBundle({ physical_verification: physical, browser_evidence: browser, identity });
  assert.equal(first.evidence_digest, second.evidence_digest);
});
