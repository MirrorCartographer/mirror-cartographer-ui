'use strict';

const { selectForDate } = require('./selectHourlyProduction.v1.cjs');
const { verifyRepertorySafetyContract } = require('./verifyRepertorySafetyContract.v1.cjs');

/**
 * Builds an operations-only receipt for the production programmed by the
 * deterministic UTC repertory. It deliberately does not infer deployment,
 * browser activation, audibility, or physical-device verification.
 */
function buildProgrammedStageReceipt(repertory, date, options = {}) {
  const safety = verifyRepertorySafetyContract(repertory);
  const selection = selectForDate(repertory, date);

  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('options must be an object');
  }

  const allowed = new Set(['source_commit']);
  const unsupported = Object.keys(options).filter((key) => !allowed.has(key));
  if (unsupported.length > 0) {
    throw new Error(`unsupported programmed stage receipt field: ${unsupported.join(', ')}`);
  }

  const sourceCommit = options.source_commit;
  if (sourceCommit !== undefined && !/^[0-9a-f]{40}$/.test(sourceCommit)) {
    throw new Error('source_commit must be a lowercase 40-character commit SHA when provided');
  }

  return Object.freeze({
    schema_version: 1,
    evidence_class: 'deterministic_programmed_stage_identity_only',
    contract_id: repertory.contract_id,
    source_commit: sourceCommit || null,
    selected_at: date.toISOString(),
    utc_hour: selection.utc_hour,
    programmed_production: Object.freeze({
      id: selection.production_id,
      title: selection.title,
      form: selection.form,
      continuity_role: selection.continuity_role,
      repertory_status: selection.status,
    }),
    continuity_state_preserved: true,
    safety_contract_verified: safety.verified === true,
    runtime_activation_claimed: false,
    deployment_claimed: false,
    browser_execution_claimed: false,
    audio_playback_claimed: false,
    physical_device_verification_claimed: false,
    side_effects_performed: false,
  });
}

module.exports = { buildProgrammedStageReceipt };
