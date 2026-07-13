const SHA40 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const NON_EMPTY = /\S/;

function parseTime(value, field) {
  if (typeof value !== 'string' || !NON_EMPTY.test(value)) {
    throw new Error(`${field} missing`);
  }
  const millis = Date.parse(value);
  if (!Number.isFinite(millis)) {
    throw new Error(`${field} invalid`);
  }
  return millis;
}

function assertObservation(observation, label) {
  if (!observation || typeof observation !== 'object' || Array.isArray(observation)) {
    throw new TypeError(`${label} observation must be an object`);
  }
  if (!SHA40.test(observation.commit_sha ?? '')) {
    throw new Error(`${label} commit_sha invalid`);
  }
  if (!SHA256.test(observation.canonical_sha256 ?? '')) {
    throw new Error(`${label} canonical_sha256 invalid`);
  }
  for (const field of ['method', 'authority', 'request_id']) {
    if (typeof observation[field] !== 'string' || !NON_EMPTY.test(observation[field])) {
      throw new Error(`${label} ${field} missing`);
    }
  }
}

export function assessObservationFreshness({
  target_commit_sha,
  target_commit_time,
  evaluated_at,
  max_observation_age_ms = 15 * 60 * 1000,
  max_channel_skew_ms = 5 * 60 * 1000,
  primary,
  independent
}) {
  if (!SHA40.test(target_commit_sha ?? '')) {
    throw new Error('target_commit_sha invalid');
  }
  if (!Number.isSafeInteger(max_observation_age_ms) || max_observation_age_ms < 0) {
    throw new Error('max_observation_age_ms invalid');
  }
  if (!Number.isSafeInteger(max_channel_skew_ms) || max_channel_skew_ms < 0) {
    throw new Error('max_channel_skew_ms invalid');
  }

  assertObservation(primary, 'primary');
  assertObservation(independent, 'independent');

  const commitTime = parseTime(target_commit_time, 'target_commit_time');
  const evaluatedTime = parseTime(evaluated_at, 'evaluated_at');
  const primaryTime = parseTime(primary.retrieved_at, 'primary retrieved_at');
  const independentTime = parseTime(independent.retrieved_at, 'independent retrieved_at');

  const reasons = [];
  if (primary.commit_sha !== target_commit_sha) reasons.push('primary_commit_mismatch');
  if (independent.commit_sha !== target_commit_sha) reasons.push('independent_commit_mismatch');
  if (primaryTime < commitTime) reasons.push('primary_predates_target_commit');
  if (independentTime < commitTime) reasons.push('independent_predates_target_commit');
  if (primaryTime > evaluatedTime) reasons.push('primary_from_future');
  if (independentTime > evaluatedTime) reasons.push('independent_from_future');
  if (evaluatedTime - primaryTime > max_observation_age_ms) reasons.push('primary_stale');
  if (evaluatedTime - independentTime > max_observation_age_ms) reasons.push('independent_stale');
  if (Math.abs(primaryTime - independentTime) > max_channel_skew_ms) reasons.push('channel_skew_exceeded');
  if (primary.canonical_sha256 === independent.canonical_sha256) reasons.push('identical_retained_bytes');
  if (primary.request_id === independent.request_id) reasons.push('shared_request_identity');

  const accepted = reasons.length === 0;
  return Object.freeze({
    schema_version: 1,
    target_commit_sha,
    evaluated_at,
    accepted,
    classification: accepted ? 'fresh_independent_observations' : 'freshness_or_replay_unproven',
    reasons: Object.freeze(reasons),
    observations: Object.freeze({
      primary: Object.freeze({
        method: primary.method,
        authority: primary.authority,
        retrieved_at: primary.retrieved_at,
        request_id: primary.request_id,
        canonical_sha256: primary.canonical_sha256
      }),
      independent: Object.freeze({
        method: independent.method,
        authority: independent.authority,
        retrieved_at: independent.retrieved_at,
        request_id: independent.request_id,
        canonical_sha256: independent.canonical_sha256
      })
    }),
    claim_ceiling: accepted
      ? 'fresh method-diverse observation of one authority'
      : 'replay resistance or freshness not established',
    workflow_or_deployment_claim_permitted: false,
    falsification_route: 'Retain two newly retrieved exact-commit responses with distinct request identities and byte digests, then rerun within the declared age and skew bounds.'
  });
}
