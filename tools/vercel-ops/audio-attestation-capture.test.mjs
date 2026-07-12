import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudioAttestationSession } from './audio-attestation-capture.mjs';

const COMMIT = 'a'.repeat(40);
const DEPLOYMENT = 'dpl_immutable_123456';
const BYTES = new Uint8Array(18).fill(7);

function session() {
  return createAudioAttestationSession({ randomBytes: () => BYTES, now: () => '2026-07-12T11:30:00.000Z' });
}

test('creates a deterministic opaque session id under injected entropy', () => {
  assert.equal(session().session_id, 'BwcHBwcHBwcHBwcHBwcHBwcH');
});

test('emits a valid allowlisted positive binding', () => {
  const result = session()
    .recordActivation('2026-07-12T11:25:00Z')
    .recordRuntime({ audio_context_state: 'running', source_started: true, destination_connected: true }, '2026-07-12T11:25:02Z')
    .recordHumanOutcome(true, '2026-07-12T11:25:05Z')
    .finalize({ commit_sha: COMMIT, deployment_id: DEPLOYMENT, device_class: 'physical_iphone' }, { now: '2026-07-12T11:30:00Z' });
  assert.equal(result.valid, true);
  assert.deepEqual(Object.keys(result.binding).sort(), ['classification','commit_sha','deployment_id','device_class','human_observed_at','human_reported_audible','session_id'].sort());
});

test('emits a valid bounded contradiction', () => {
  const result = session()
    .recordActivation('2026-07-12T11:25:00Z')
    .recordRuntime({ audio_context_state: 'running', source_started: true, destination_connected: true }, '2026-07-12T11:25:02Z')
    .recordHumanOutcome(false, '2026-07-12T11:25:05Z')
    .finalize({ commit_sha: COMMIT, deployment_id: DEPLOYMENT, device_class: 'physical_iphone' }, { now: '2026-07-12T11:30:00Z' });
  assert.equal(result.valid, true);
  assert.equal(result.binding.classification, 'contradicted');
});

test('rejects runtime capture before activation', () => {
  assert.throws(() => session().recordRuntime({}, '2026-07-12T11:25:02Z'), /activation_required/);
});

test('rejects human outcome before runtime capture', () => {
  assert.throws(() => session().recordActivation('2026-07-12T11:25:00Z').recordHumanOutcome(true), /runtime_required/);
});

test('rejects duplicate lifecycle observations', () => {
  const capture = session().recordActivation('2026-07-12T11:25:00Z');
  assert.throws(() => capture.recordActivation('2026-07-12T11:25:01Z'), /activation_already_recorded/);
});

test('fails closed when runtime route is incomplete', () => {
  const result = session()
    .recordActivation('2026-07-12T11:25:00Z')
    .recordRuntime({ audio_context_state: 'running', source_started: true, destination_connected: false }, '2026-07-12T11:25:02Z')
    .recordHumanOutcome(true, '2026-07-12T11:25:05Z')
    .finalize({ commit_sha: COMMIT, deployment_id: DEPLOYMENT, device_class: 'physical_iphone' }, { now: '2026-07-12T11:30:00Z' });
  assert.deepEqual(result, { valid: false, reason: 'runtime_route_incomplete', binding: null });
});
