const SHA40 = /^[0-9a-f]{40}$/;
const DEPLOYMENT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{5,199}$/;
const SESSION_ID = /^[A-Za-z0-9_-]{16,128}$/;
const ALLOWED_CLASSIFICATIONS = new Set(['human_confirmed', 'contradicted']);
const ALLOWED_DEVICES = new Set(['physical_iphone']);
const MAX_OBSERVATION_AGE_MS = 15 * 60 * 1000;
const MAX_SESSION_SPAN_MS = 10 * 60 * 1000;

export function validateAudioAttestationBinding(input = {}, options = {}) {
  const nowMs = parseTime(options.now ?? new Date().toISOString());
  if (nowMs === null) return fail('invalid_verifier_time');

  const commitSha = normalize(input.commit_sha);
  if (!SHA40.test(commitSha)) return fail('invalid_commit_sha');

  const deploymentId = normalize(input.deployment_id);
  if (!DEPLOYMENT_ID.test(deploymentId)) return fail('invalid_deployment_id');

  const sessionId = normalize(input.session_id);
  if (!SESSION_ID.test(sessionId)) return fail('invalid_session_id');

  if (!ALLOWED_DEVICES.has(input.device_class)) return fail('unsupported_device_class');
  if (!ALLOWED_CLASSIFICATIONS.has(input.classification)) return fail('non_terminal_classification');
  if (input.classification === 'human_confirmed' && input.human_reported_audible !== true) {
    return fail('human_confirmation_mismatch');
  }
  if (input.classification === 'contradicted' && input.human_reported_audible !== false) {
    return fail('contradiction_mismatch');
  }

  const activatedMs = parseTime(input.user_activation_at);
  const runtimeMs = parseTime(input.runtime_observed_at);
  const humanMs = parseTime(input.human_observed_at);
  if ([activatedMs, runtimeMs, humanMs].some((value) => value === null)) return fail('invalid_observation_time');
  if (!(activatedMs <= runtimeMs && runtimeMs <= humanMs)) return fail('invalid_observation_order');
  if (humanMs - activatedMs > MAX_SESSION_SPAN_MS) return fail('session_span_exceeded');
  if (humanMs > nowMs + 30_000) return fail('future_observation');
  if (nowMs - humanMs > MAX_OBSERVATION_AGE_MS) return fail('stale_observation');

  if (input.audio_context_state !== 'running') return fail('audio_context_not_running');
  if (input.source_started !== true || input.destination_connected !== true) return fail('runtime_route_incomplete');

  return Object.freeze({
    valid: true,
    reason: 'attestation_bound',
    binding: Object.freeze({
      commit_sha: commitSha,
      deployment_id: deploymentId,
      session_id: sessionId,
      device_class: input.device_class,
      classification: input.classification,
      human_reported_audible: input.human_reported_audible,
      human_observed_at: new Date(humanMs).toISOString()
    })
  });
}

function normalize(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseTime(value) {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function fail(reason) {
  return Object.freeze({ valid: false, reason, binding: null });
}
