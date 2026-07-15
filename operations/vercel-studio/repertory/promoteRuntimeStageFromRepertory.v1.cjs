'use strict';

const { selectHourlyProduction, validateRepertory } = require('./selectHourlyProduction.v1.cjs');
const { promoteRuntimeStageEvidenceV1 } = require('./promoteRuntimeStageEvidence.v1.cjs');

function assertContractId(repertory) {
  if (typeof repertory.contract_id !== 'string' || repertory.contract_id.trim() === '') {
    throw new Error('repertory.contract_id must be a non-empty string');
  }
}

function parseCheckedAt(checkedAt) {
  if (typeof checkedAt !== 'string' || checkedAt.trim() === '') {
    throw new Error('checkedAt must be a non-empty string');
  }
  const date = new Date(checkedAt);
  if (Number.isNaN(date.getTime())) throw new Error('checkedAt must be a valid instant');
  return date;
}

function promoteRuntimeStageFromRepertoryV1({
  stageVerification,
  checkedAt,
  repertory,
  maxAgeMs,
  futureSkewMs,
}) {
  validateRepertory(repertory);
  assertContractId(repertory);
  const checkedAtDate = parseCheckedAt(checkedAt);
  const selected = selectHourlyProduction(repertory, checkedAtDate.getUTCHours());
  const expectedStage = Object.freeze({
    production_id: selected.production_id,
    repertory_contract_id: repertory.contract_id,
    repertory_hour_utc: selected.utc_hour,
  });
  const promoted = promoteRuntimeStageEvidenceV1({
    stageVerification,
    checkedAt: checkedAtDate.toISOString(),
    expectedStage,
    maxAgeMs,
    futureSkewMs,
  });
  return Object.freeze({
    ...promoted,
    contract_id: 'vercel-studio-runtime-stage-repertory-promotion-v1',
    classification: 'commit_bound_runtime_stage_promotable_canonical_repertory',
    repertory_selection: Object.freeze({ ...selected }),
  });
}

module.exports = { promoteRuntimeStageFromRepertoryV1 };
