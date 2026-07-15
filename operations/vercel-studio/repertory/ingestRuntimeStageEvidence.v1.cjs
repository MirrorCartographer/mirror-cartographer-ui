'use strict';

const { promoteRuntimeStageFromRepertoryV1 } = require('./promoteRuntimeStageFromRepertory.v1.cjs');

const ALLOWED_KEYS = new Set([
  'stageVerification',
  'checkedAt',
  'repertory',
  'maxAgeMs',
  'futureSkewMs',
]);

function assertCanonicalInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('runtime stage ingestion input must be an object');
  }
  for (const key of Object.keys(input)) {
    if (!ALLOWED_KEYS.has(key)) {
      throw new Error(`unsupported runtime stage ingestion field: ${key}`);
    }
  }
  if ('expectedStage' in input || 'expected_stage' in input) {
    throw new Error('caller-supplied expected stage identity is forbidden');
  }
}

function ingestRuntimeStageEvidenceV1(input) {
  assertCanonicalInput(input);
  const promoted = promoteRuntimeStageFromRepertoryV1(input);
  return Object.freeze({
    ...promoted,
    contract_id: 'vercel-studio-runtime-stage-ingestion-v1',
    classification: 'canonical_repertory_runtime_stage_ingested',
    ingestion_boundary: 'repertory_derived_identity_only',
  });
}

module.exports = {
  ingestRuntimeStageEvidenceV1,
};
