const ALLOWED_SOURCES = new Set(['vercel_deployment_attempt', 'vercel_api', 'vercel_dashboard']);
const ALLOWED_OUTCOMES = new Set(['available', 'rate_limited', 'unknown']);

export function validateCapacityObservation(input = {}, options = {}) {
  const nowMs = Date.parse(options.now ?? new Date().toISOString());
  const observedMs = Date.parse(input.observed_at ?? '');
  const maxAgeMs = Number.isFinite(options.max_age_ms) ? options.max_age_ms : 15 * 60 * 1000;
  const source = input.source;
  const outcome = input.outcome;

  if (!Number.isFinite(nowMs) || !Number.isFinite(observedMs)) {
    return decision(false, 'invalid_observation_time');
  }
  if (!ALLOWED_SOURCES.has(source)) {
    return decision(false, 'unsupported_observation_source');
  }
  if (!ALLOWED_OUTCOMES.has(outcome)) {
    return decision(false, 'unsupported_observation_outcome');
  }

  const ageMs = nowMs - observedMs;
  if (ageMs < 0) return decision(false, 'observation_from_future');
  if (ageMs > maxAgeMs) return decision(false, 'observation_stale');
  if (outcome !== 'available') return decision(false, `provider_${outcome}`);
  if (input.commit_sha && !/^[0-9a-f]{40}$/i.test(input.commit_sha)) {
    return decision(false, 'invalid_commit_sha');
  }

  return Object.freeze({
    schema_version: 1,
    valid: true,
    reason: 'capacity_observed_available',
    provider_capacity: 'available',
    observed_at: new Date(observedMs).toISOString(),
    expires_at: new Date(observedMs + maxAgeMs).toISOString(),
    source,
    commit_sha: input.commit_sha ?? null,
    fail_closed: false
  });
}

function decision(valid, reason) {
  return Object.freeze({
    schema_version: 1,
    valid,
    reason,
    provider_capacity: 'unknown',
    fail_closed: true
  });
}
