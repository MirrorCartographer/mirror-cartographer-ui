import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePhysicalAudioVerification } from './physical-audio-verification.mjs';

const base = {
  commit_sha: 'a'.repeat(40),
  deployment_id: 'dpl_123',
  deployment_url: 'https://example.vercel.app',
  device: { family: 'iPhone', model: 'iPhone 15', os: 'iOS 19.0' },
  browser: { name: 'Safari', version: '19.0' },
  trials: [1,2,3].map((index) => ({
    index,
    transient_activation: true,
    route_complete: true,
    audio_context_state: 'running',
    audible: true,
    observed_at: `2026-07-12T13:0${index}:00Z`
  }))
};

test('accepts three unanimous audible trials', () => {
  const result = validatePhysicalAudioVerification(base);
  assert.equal(result.valid, true);
  assert.equal(result.accepted, true);
  assert.equal(result.classification, 'accepted');
});

test('preserves mixed human outcomes as contradiction', () => {
  const record = structuredClone(base);
  record.trials[1].audible = false;
  const result = validatePhysicalAudioVerification(record);
  assert.equal(result.valid, true);
  assert.equal(result.accepted, false);
  assert.equal(result.classification, 'contradicted');
  assert.equal(result.contradiction_preserved, true);
});

test('rejects unanimous inaudible trials without invalidating record structure', () => {
  const record = structuredClone(base);
  record.trials.forEach((trial) => { trial.audible = false; });
  const result = validatePhysicalAudioVerification(record);
  assert.equal(result.valid, true);
  assert.equal(result.classification, 'rejected');
});

test('fails closed on wrong device or missing activation', () => {
  const record = structuredClone(base);
  record.device.family = 'iPad';
  record.trials[0].transient_activation = false;
  const result = validatePhysicalAudioVerification(record);
  assert.equal(result.valid, false);
  assert.ok(result.failures.includes('device_not_iphone'));
  assert.ok(result.failures.includes('trial_1_activation_missing'));
});

test('digest is deterministic for equivalent records', () => {
  const first = validatePhysicalAudioVerification(base);
  const second = validatePhysicalAudioVerification(structuredClone(base));
  assert.equal(first.evidence_digest, second.evidence_digest);
});
