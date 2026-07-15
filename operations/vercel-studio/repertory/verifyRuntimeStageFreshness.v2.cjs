'use strict';

const DEFAULT_MAX_AGE_MS = 70 * 60 * 1000;
const DEFAULT_FUTURE_SKEW_MS = 5 * 60 * 1000;

function assertObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
}

function assertNonEmptyString(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
}

function assertPositiveInteger(value, field) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }
}

function parseInstant(value, field) {
  assertNonEmptyString(value, field);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${field} must be a valid instant`);
  }
  return parsed;
}

function normalizeHttpsUrl(value, field) {
  assertNonEmptyString(value, field);
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${field} must be a valid URL`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`${field} must use HTTPS`);
  }
  if (parsed.username || parsed.password) {
    throw new Error(`${field} must not contain credentials`);
  }
  return parsed.toString();
}

function verifyRuntimeStageFreshnessV2({
  stageVerification,
  checkedAt,
  maxAgeMs = DEFAULT_MAX_AGE_MS,
  futureSkewMs = DEFAULT_FUTURE_SKEW_MS,
}) {
  assertObject(stageVerification, 'stageVerification');
  if (stageVerification.contract_id !== 'vercel-studio-runtime-stage-verification-v1') {
    throw new Error('unsupported stageVerification contract_id');
  }
  if (stageVerification.verified !== true) {
    throw new Error('stageVerification.verified must be true');
  }
  if (stageVerification.classification !== 'commit_bound_runtime_stage_verified') {
    throw new Error('stageVerification classification is not promotable');
  }

  const requiredStrings = [
    'production_id',
    'commit_sha',
    'deployment_id',
    'deployment_url',
    'repertory_contract_id',
  ];
  for (const field of requiredStrings) {
    assertNonEmptyString(stageVerification[field], `stageVerification.${field}`);
  }
  if (!/^[0-9a-f]{40}$/i.test(stageVerification.commit_sha)) {
    throw new Error('stageVerification.commit_sha must be a 40-character hexadecimal commit SHA');
  }
  if (stageVerification.audio_policy_verified !== true) {
    throw new Error('stageVerification.audio_policy_verified must be true');
  }
  if (stageVerification.privacy_boundary_verified !== true) {
    throw new Error('stageVerification.privacy_boundary_verified must be true');
  }
  if (stageVerification.side_effects_performed !== false) {
    throw new Error('stageVerification.side_effects_performed must be false');
  }

  assertPositiveInteger(maxAgeMs, 'maxAgeMs');
  assertPositiveInteger(futureSkewMs, 'futureSkewMs');

  const observedAt = parseInstant(stageVerification.observed_at, 'stageVerification.observed_at');
  const checkedAtDate = parseInstant(checkedAt, 'checkedAt');
  const ageMs = checkedAtDate.getTime() - observedAt.getTime();
  if (ageMs < -futureSkewMs) throw new Error('stage verification observation is too far in the future');
  if (ageMs > maxAgeMs) throw new Error('stage verification observation is stale');

  return Object.freeze({
    contract_id: 'vercel-studio-runtime-stage-freshness-v2',
    verified: true,
    classification: 'commit_bound_runtime_stage_fresh_identity_bound',
    checked_at: checkedAtDate.toISOString(),
    observed_at: observedAt.toISOString(),
    age_ms: ageMs,
    max_age_ms: maxAgeMs,
    future_skew_ms: futureSkewMs,
    production_id: stageVerification.production_id,
    commit_sha: stageVerification.commit_sha.toLowerCase(),
    deployment_id: stageVerification.deployment_id,
    deployment_url: normalizeHttpsUrl(stageVerification.deployment_url, 'stageVerification.deployment_url'),
    repertory_contract_id: stageVerification.repertory_contract_id,
    audio_policy_verified: true,
    privacy_boundary_verified: true,
    side_effects_performed: false,
  });
}

module.exports = {
  DEFAULT_FUTURE_SKEW_MS,
  DEFAULT_MAX_AGE_MS,
  verifyRuntimeStageFreshnessV2,
};
