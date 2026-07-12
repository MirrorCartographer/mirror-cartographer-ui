import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAudioAttestationBinding } from './audio-attestation-binding.mjs';

const now = '2026-07-12T10:30:00.000Z';
const base = {
  commit_sha: 'a'.repeat(40),
  deployment_id: 'dpl_immutable_123456',
  session_id: 'session_0123456789abcdef',
  device_class: 'physical_iphone',
  classification: 'human_confirmed',
  human_reported_audible: true,
  user_activation_at: '2026-07-12T10:25:00.000Z',
  runtime_observed_at: '2026-07-12T10:25:02.000Z',
  human_observed_at: '2026-07-12T10:25:05.000Z',
  audio_context_state: 'running',
  source_started: true,
  destination_connected: true,
  private_notes: 'must not survive'
};

test('accepts a fresh exact deployment/device/session binding', () => {
  const result = validateAudioAttestationBinding(base, { now });
  assert.equal(result.valid, true);
  assert.equal(result.binding.commit_sha, base.commit_sha);
  assert.equal('private_notes' in result.binding, false);
});

test('rejects stale human observation', () => {
  const result = validateAudioAttestationBinding({ ...base, user_activation_at: '2026-07-12T09:59:55.000Z', runtime_observed_at: '2026-07-12T09:59:58.000Z', human_observed_at: '2026-07-12T10:00:00.000Z' }, { now });
  assert.deepEqual(result, { valid: false, reason: 'stale_observation', binding: null });
});

test('rejects a non-physical iPhone device class', () => {
  const result = validateAudioAttestationBinding({ ...base, device_class: 'simulator' }, { now });
  assert.equal(result.reason, 'unsupported_device_class');
});

test('rejects human-confirmed classification without audible report', () => {
  const result = validateAudioAttestationBinding({ ...base, human_reported_audible: false }, { now });
  assert.equal(result.reason, 'human_confirmation_mismatch');
});

test('accepts a bounded contradiction as terminal negative evidence', () => {
  const result = validateAudioAttestationBinding({ ...base, classification: 'contradicted', human_reported_audible: false }, { now });
  assert.equal(result.valid, true);
  assert.equal(result.binding.classification, 'contradicted');
});

test('rejects incomplete runtime routing', () => {
  const result = validateAudioAttestationBinding({ ...base, destination_connected: false }, { now });
  assert.equal(result.reason, 'runtime_route_incomplete');
});

test('rejects observations from different temporal order', () => {
  const result = validateAudioAttestationBinding({ ...base, runtime_observed_at: '2026-07-12T10:24:59.000Z' }, { now });
  assert.equal(result.reason, 'invalid_observation_order');
});
