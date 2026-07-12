import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAudioActivationAttestation } from './audio-activation-attestation.mjs';

const base = {
  commit_sha: 'a'.repeat(40),
  deployment_id: 'dpl_frontier_audio_001',
  session_id: 'session_frontier_audio_0001',
  activation_event: {
    type: 'touchend',
    is_trusted: true,
    captured_at_performance_ms: 1000
  },
  resume_called_at_performance_ms: 1002,
  resume_settled_at_performance_ms: 1015,
  resume_promise_status: 'fulfilled',
  audio_context_state_after: 'running',
  user_activation: {
    has_been_active: true,
    is_active: true
  }
};

test('accepts trusted touch activation bound to fulfilled resume', () => {
  const result = validateAudioActivationAttestation(base);
  assert.equal(result.valid, true);
  assert.equal(result.classification, 'trusted_activation_bound_resume_observed');
  assert.equal(result.resume.latency_ms, 13);
});

test('rejects synthetic events', () => {
  const result = validateAudioActivationAttestation({
    ...base,
    activation_event: { ...base.activation_event, is_trusted: false }
  });
  assert.equal(result.reason, 'activation_event_not_trusted');
});

test('rejects mouse pointerup because it is not activation-triggering', () => {
  const result = validateAudioActivationAttestation({
    ...base,
    activation_event: {
      type: 'pointerup',
      pointer_type: 'mouse',
      is_trusted: true,
      captured_at_performance_ms: 1000
    }
  });
  assert.equal(result.reason, 'invalid_pointer_activation_semantics');
});

test('accepts touch pointerup', () => {
  const result = validateAudioActivationAttestation({
    ...base,
    activation_event: {
      type: 'pointerup',
      pointer_type: 'touch',
      is_trusted: true,
      captured_at_performance_ms: 1000
    }
  });
  assert.equal(result.valid, true);
});

test('rejects delayed resume binding', () => {
  const result = validateAudioActivationAttestation({
    ...base,
    resume_called_at_performance_ms: 7001,
    resume_settled_at_performance_ms: 7010
  });
  assert.equal(result.reason, 'activation_binding_too_late');
});

test('rejects fulfilled resume when context is not running', () => {
  const result = validateAudioActivationAttestation({
    ...base,
    audio_context_state_after: 'interrupted'
  });
  assert.equal(result.reason, 'context_not_running_after_resume');
});

test('rejects missing sticky activation observation', () => {
  const result = validateAudioActivationAttestation({
    ...base,
    user_activation: { has_been_active: false, is_active: false }
  });
  assert.equal(result.reason, 'sticky_activation_not_observed');
});
