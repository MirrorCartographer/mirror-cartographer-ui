'use strict';

const DEFAULT_MAX_AGE_MS = 70 * 60 * 1000;
const DEFAULT_FUTURE_SKEW_MS = 5 * 60 * 1000;

function parseInstant(value, field) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${field} must be a valid instant`);
  }
  return parsed;
}

function assertPositiveInteger(value, field) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }
}

function verifyRuntimeStageFreshness({
  stageVerification,
  checkedAt,
  maxAgeMs = DEFAULT_MAX_AGE_MS,
  futureSkewMs = DEFAULT_FUTURE_SKEW_MS,
}) {
  if (!stageVerification || typeof stageVerification !== 'object' || Array.isArray(stageVerification)) {
    throw new Error('stageVerification must be an object');
  }
  if (stageVerification.contract_id !== 'vercel-studio-runtime-stage-verification-v1') {
    throw new Error('unsupported stageVerification contract_id');
  }
  if (stageVerification.verified !== true) {
    throw new Error('stageVerification.verified must be true');
  }
  if (stageVerification.classification !== 'commit_bound_runtime_stage_verified') {
    throw new Error('stageVerification classification is not promotable');
  }

  assertPositiveInteger(maxAgeMs, 'maxAgeMs');
  assertPositiveInteger(futureSkewMs, 'futureSkewMs');

  const observedAt = parseInstant(stageVerification.observed_at, 'stageVerification.observed_at');
  const checkedAtDate = parseInstant(checkedAt, 'checkedAt');
  const ageMs = checkedAtDate.getTime() - observedAt.getTime();

  if (ageMs < -futureSkewMs) {
    throw new Error('stage verification observation is too far in the future');
  }
  if (ageMs > maxAgeMs) {
    throw new Error('stage verification observation is stale');
  }

  return Object.freeze({
    contract_id: 'vercel-studio-runtime-stage-freshness-v1',
    verified: true,
    classification: 'commit_bound_runtime_stage_fresh',
    checked_at: checkedAtDate.toISOString(),
    observed_at: observedAt.toISOString(),
    age_ms: ageMs,
    max_age_ms: maxAgeMs,
    future_skew_ms: futureSkewMs,
    production_id: stageVerification.production_id,
    commit_sha: stageVerification.commit_sha,
    deployment_id: stageVerification.deployment_id,
    deployment_url: stageVerification.deployment_url,
    repertory_contract_id: stageVerification.repertory_contract_id,
    audio_policy_verified: stageVerification.audio_policy_verified === true,
    privacy_boundary_verified: stageVerification.privacy_boundary_verified === true,
    side_effects_performed: false,
  });
}

module.exports = {
  DEFAULT_FUTURE_SKEW_MS,
  DEFAULT_MAX_AGE_MS,
  verifyRuntimeStageFreshness,
};
