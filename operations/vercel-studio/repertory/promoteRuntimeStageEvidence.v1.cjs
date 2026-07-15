'use strict';

const { verifyRuntimeStageFreshnessV3 } = require('./verifyRuntimeStageFreshness.v3.cjs');

function assertExpectedStage(expectedStage) {
  if (!expectedStage || typeof expectedStage !== 'object' || Array.isArray(expectedStage)) {
    throw new Error('expectedStage must be an object');
  }
  for (const field of ['production_id', 'repertory_contract_id']) {
    if (typeof expectedStage[field] !== 'string' || expectedStage[field].trim() === '') {
      throw new Error(`expectedStage.${field} must be a non-empty string`);
    }
  }
  if (
    !Number.isInteger(expectedStage.repertory_hour_utc)
    || expectedStage.repertory_hour_utc < 0
    || expectedStage.repertory_hour_utc > 23
  ) {
    throw new Error('expectedStage.repertory_hour_utc must be an integer from 0 through 23');
  }
}

function promoteRuntimeStageEvidenceV1({
  stageVerification,
  checkedAt,
  expectedStage,
  maxAgeMs,
  futureSkewMs,
}) {
  assertExpectedStage(expectedStage);
  const fresh = verifyRuntimeStageFreshnessV3({
    stageVerification,
    checkedAt,
    maxAgeMs,
    futureSkewMs,
  });

  if (fresh.production_id !== expectedStage.production_id) {
    throw new Error('fresh runtime evidence production_id does not match the deterministic expected stage');
  }
  if (fresh.repertory_contract_id !== expectedStage.repertory_contract_id) {
    throw new Error('fresh runtime evidence repertory_contract_id does not match the deterministic expected stage');
  }
  if (fresh.repertory_hour_utc !== expectedStage.repertory_hour_utc) {
    throw new Error('fresh runtime evidence hour does not match the deterministic expected stage');
  }

  return Object.freeze({
    ...fresh,
    contract_id: 'vercel-studio-runtime-stage-promotion-v1',
    classification: 'commit_bound_runtime_stage_promotable_expected_identity',
    expected_stage: Object.freeze({ ...expectedStage }),
  });
}

module.exports = {
  promoteRuntimeStageEvidenceV1,
};
