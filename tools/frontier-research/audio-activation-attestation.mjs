const SHA40 = /^[0-9a-f]{40}$/;
const DEPLOYMENT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{5,199}$/;
const SESSION_ID = /^[A-Za-z0-9_-]{16,128}$/;
const EVENT_TYPES = new Set(['keydown', 'mousedown', 'pointerdown', 'pointerup', 'touchend']);
const TERMINAL_STATES = new Set(['running', 'interrupted']);
const MAX_RESUME_DELAY_MS = 5000;

export function validateAudioActivationAttestation(input = {}) {
  const commitSha = normalize(input.commit_sha);
  const deploymentId = normalize(input.deployment_id);
  const sessionId = normalize(input.session_id);

  if (!SHA40.test(commitSha)) return fail('invalid_commit_sha');
  if (!DEPLOYMENT_ID.test(deploymentId)) return fail('invalid_deployment_id');
  if (!SESSION_ID.test(sessionId)) return fail('invalid_session_id');

  const event = input.activation_event ?? {};
  if (event.is_trusted !== true) return fail('activation_event_not_trusted');
  if (!EVENT_TYPES.has(event.type)) return fail('invalid_activation_event_type');
  if (!eventTypeMatchesPointer(event)) return fail('invalid_pointer_activation_semantics');

  const eventAt = finiteNumber(event.captured_at_performance_ms);
  const resumeCalledAt = finiteNumber(input.resume_called_at_performance_ms);
  const resumeSettledAt = finiteNumber(input.resume_settled_at_performance_ms);
  if ([eventAt, resumeCalledAt, resumeSettledAt].includes(null)) return fail('invalid_timing');
  if (resumeCalledAt < eventAt) return fail('resume_precedes_activation');
  if (resumeSettledAt < resumeCalledAt) return fail('resume_settles_before_call');
  if (resumeCalledAt - eventAt > MAX_RESUME_DELAY_MS) return fail('activation_binding_too_late');

  if (input.resume_promise_status !== 'fulfilled') return fail('resume_not_fulfilled');
  if (!TERMINAL_STATES.has(input.audio_context_state_after)) return fail('invalid_context_state_after_resume');
  if (input.audio_context_state_after !== 'running') return fail('context_not_running_after_resume');

  const activation = input.user_activation ?? {};
  if (activation.has_been_active !== true) return fail('sticky_activation_not_observed');
  if (activation.is_active !== true && activation.is_active !== false && activation.is_active !== null) {
    return fail('invalid_transient_activation_observation');
  }

  return Object.freeze({
    valid: true,
    reason: 'trusted_activation_bound_resume_observed',
    classification: 'trusted_activation_bound_resume_observed',
    binding: Object.freeze({
      commit_sha: commitSha,
      deployment_id: deploymentId,
      session_id: sessionId
    }),
    activation_event: Object.freeze({
      type: event.type,
      pointer_type: event.pointer_type ?? null,
      is_trusted: true,
      captured_at_performance_ms: eventAt
    }),
    resume: Object.freeze({
      called_at_performance_ms: resumeCalledAt,
      settled_at_performance_ms: resumeSettledAt,
      latency_ms: resumeSettledAt - resumeCalledAt,
      audio_context_state_after: input.audio_context_state_after
    }),
    user_activation: Object.freeze({
      has_been_active: true,
      is_active: activation.is_active ?? null
    }),
    epistemic_limits: Object.freeze([
      'A fulfilled resume promise and running AudioContext do not prove that audio reached a physical output device.',
      'Sticky activation proves prior interaction, not that the exact event caused every later gated operation.',
      'Human audibility requires separate physical-device evidence.'
    ])
  });
}

function eventTypeMatchesPointer(event) {
  if (event.type === 'pointerdown') return event.pointer_type === 'mouse';
  if (event.type === 'pointerup') return event.pointer_type !== 'mouse' && typeof event.pointer_type === 'string';
  return true;
}

function normalize(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function fail(reason) {
  return Object.freeze({ valid: false, reason, classification: null });
}
