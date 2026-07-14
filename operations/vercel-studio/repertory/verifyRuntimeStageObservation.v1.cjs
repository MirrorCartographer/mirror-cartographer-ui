'use strict';

const { selectHourlyProduction, validateRepertory } = require('./selectHourlyProduction.v1.cjs');

function assertNonEmptyString(value, field) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
}

function verifyRuntimeStageObservation({ repertory, observation, expectedCommitSha }) {
  validateRepertory(repertory);
  assertNonEmptyString(expectedCommitSha, 'expectedCommitSha');
  if (!/^[0-9a-f]{40}$/i.test(expectedCommitSha)) {
    throw new Error('expectedCommitSha must be a 40-character hexadecimal commit SHA');
  }
  if (!observation || typeof observation !== 'object' || Array.isArray(observation)) {
    throw new Error('observation must be an object');
  }

  const requiredStrings = [
    'contract_id',
    'observed_at',
    'commit_sha',
    'deployment_id',
    'deployment_url',
    'repertory_contract_id',
    'production_id',
    'source',
  ];
  for (const field of requiredStrings) assertNonEmptyString(observation[field], `observation.${field}`);

  if (observation.contract_id !== 'vercel-studio-runtime-stage-observation-v1') {
    throw new Error('unsupported observation contract_id');
  }
  if (!/^[0-9a-f]{40}$/i.test(observation.commit_sha)) {
    throw new Error('observation.commit_sha must be a 40-character hexadecimal commit SHA');
  }
  if (observation.commit_sha.toLowerCase() !== expectedCommitSha.toLowerCase()) {
    throw new Error('observation commit does not match expected commit');
  }
  if (observation.repertory_contract_id !== repertory.contract_id) {
    throw new Error('observation repertory contract does not match active repertory');
  }
  if (observation.source !== 'runtime_dom_probe') {
    throw new Error('observation.source must be runtime_dom_probe');
  }
  if (observation.deployment_verified !== true) {
    throw new Error('observation.deployment_verified must be true');
  }
  if (observation.autoplay_audio_detected !== false) {
    throw new Error('observation.autoplay_audio_detected must be false');
  }
  if (observation.private_source_material_detected !== false) {
    throw new Error('observation.private_source_material_detected must be false');
  }

  let deploymentUrl;
  try {
    deploymentUrl = new URL(observation.deployment_url);
  } catch {
    throw new Error('observation.deployment_url must be a valid URL');
  }
  if (deploymentUrl.protocol !== 'https:') {
    throw new Error('observation.deployment_url must use HTTPS');
  }

  const observedAt = new Date(observation.observed_at);
  if (Number.isNaN(observedAt.getTime())) {
    throw new Error('observation.observed_at must be a valid instant');
  }
  const selected = selectHourlyProduction(repertory, observedAt.getUTCHours());
  if (observation.production_id !== selected.production_id) {
    throw new Error('observed production does not match deterministic hourly selection');
  }

  return Object.freeze({
    contract_id: 'vercel-studio-runtime-stage-verification-v1',
    verified: true,
    classification: 'commit_bound_runtime_stage_verified',
    observed_at: observedAt.toISOString(),
    utc_hour: observedAt.getUTCHours(),
    production_id: selected.production_id,
    commit_sha: observation.commit_sha.toLowerCase(),
    deployment_id: observation.deployment_id,
    deployment_url: deploymentUrl.toString(),
    repertory_contract_id: repertory.contract_id,
    audio_policy_verified: true,
    privacy_boundary_verified: true,
    side_effects_performed: false,
  });
}

module.exports = { verifyRuntimeStageObservation };
