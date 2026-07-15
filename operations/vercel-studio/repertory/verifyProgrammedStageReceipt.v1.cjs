'use strict';

const FALSE_CLAIM_FIELDS = Object.freeze([
  'runtime_activation_claimed',
  'deployment_claimed',
  'browser_execution_claimed',
  'audio_playback_claimed',
  'physical_device_verification_claimed',
  'side_effects_performed',
]);

const PRODUCTION_METADATA_FIELDS = Object.freeze([
  'title',
  'form',
  'continuity_role',
  'repertory_status',
]);

function parseCanonicalIsoInstant(value) {
  if (typeof value !== 'string') return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) return null;
  return parsed;
}

function verifyProgrammedStageReceipt(receipt, expected = {}) {
  const violations = [];
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    return Object.freeze({ verified: false, violations: ['receipt_not_object'] });
  }
  if (receipt.schema_version !== 1) violations.push('unsupported_schema_version');
  if (receipt.evidence_class !== 'commit_and_repertory_bound_programmed_stage_identity_only') violations.push('wrong_evidence_class');
  if (!/^[0-9a-f]{40}$/.test(receipt.source_commit || '')) violations.push('invalid_source_commit');
  if (!/^[0-9a-f]{64}$/.test(receipt.repertory_sha256 || '')) violations.push('invalid_repertory_digest');
  if (typeof receipt.repertory_contract_id !== 'string' || receipt.repertory_contract_id.length === 0) violations.push('missing_repertory_contract_id');
  if (receipt.exact_commit_bound !== true) violations.push('exact_commit_not_bound');
  if (receipt.repertory_content_bound !== true) violations.push('repertory_content_not_bound');
  if (receipt.safety_contract_verified !== true) violations.push('safety_contract_unverified');
  if (receipt.continuity_state_preserved !== true) violations.push('continuity_not_preserved');
  if (!Number.isInteger(receipt.utc_hour) || receipt.utc_hour < 0 || receipt.utc_hour > 23) violations.push('invalid_utc_hour');

  const generatedAt = parseCanonicalIsoInstant(receipt.generated_at);
  if (!generatedAt) violations.push('invalid_generated_at');
  else if (generatedAt.getUTCHours() !== receipt.utc_hour) violations.push('generated_at_hour_mismatch');

  if (!receipt.programmed_production || typeof receipt.programmed_production.id !== 'string' || receipt.programmed_production.id.length === 0) {
    violations.push('missing_programmed_production');
  }
  for (const field of PRODUCTION_METADATA_FIELDS) {
    if (typeof receipt.programmed_production?.[field] !== 'string' || receipt.programmed_production[field].length === 0) {
      violations.push(`missing_programmed_production_${field}`);
    }
  }
  if (!receipt.programmed_edition || typeof receipt.programmed_edition.id !== 'string' || receipt.programmed_edition.id.length === 0) violations.push('missing_programmed_edition');
  if (typeof receipt.programmed_edition?.cue !== 'string' || receipt.programmed_edition.cue.length === 0) violations.push('missing_programmed_edition_cue');
  if (receipt.programmed_edition?.utc_hour !== receipt.utc_hour) violations.push('edition_hour_mismatch');
  for (const field of FALSE_CLAIM_FIELDS) {
    if (receipt[field] !== false) violations.push(`${field}_must_be_false`);
  }
  if (expected.source_commit && receipt.source_commit !== expected.source_commit) violations.push('source_commit_mismatch');
  if (expected.repertory_sha256 && receipt.repertory_sha256 !== expected.repertory_sha256) violations.push('repertory_digest_mismatch');
  if (expected.repertory_contract_id && receipt.repertory_contract_id !== expected.repertory_contract_id) violations.push('repertory_contract_id_mismatch');
  if (expected.generated_at && receipt.generated_at !== expected.generated_at) violations.push('generated_at_mismatch');
  if (expected.utc_hour !== undefined && receipt.utc_hour !== expected.utc_hour) violations.push('utc_hour_mismatch');
  if (expected.production_id && receipt.programmed_production?.id !== expected.production_id) violations.push('production_id_mismatch');
  if (expected.production_title && receipt.programmed_production?.title !== expected.production_title) violations.push('production_title_mismatch');
  if (expected.production_form && receipt.programmed_production?.form !== expected.production_form) violations.push('production_form_mismatch');
  if (expected.production_continuity_role && receipt.programmed_production?.continuity_role !== expected.production_continuity_role) violations.push('production_continuity_role_mismatch');
  if (expected.production_repertory_status && receipt.programmed_production?.repertory_status !== expected.production_repertory_status) violations.push('production_repertory_status_mismatch');
  if (expected.edition_id && receipt.programmed_edition?.id !== expected.edition_id) violations.push('edition_id_mismatch');
  if (expected.edition_cue && receipt.programmed_edition?.cue !== expected.edition_cue) violations.push('edition_cue_mismatch');

  return Object.freeze({
    verified: violations.length === 0,
    evidence_class: receipt.evidence_class || null,
    repertory_contract_id: receipt.repertory_contract_id || null,
    source_commit: receipt.source_commit || null,
    repertory_sha256: receipt.repertory_sha256 || null,
    generated_at: receipt.generated_at || null,
    production_id: receipt.programmed_production?.id || null,
    production_title: receipt.programmed_production?.title || null,
    production_form: receipt.programmed_production?.form || null,
    production_continuity_role: receipt.programmed_production?.continuity_role || null,
    production_repertory_status: receipt.programmed_production?.repertory_status || null,
    edition_id: receipt.programmed_edition?.id || null,
    edition_cue: receipt.programmed_edition?.cue || null,
    violations: Object.freeze(violations),
  });
}

module.exports = {
  FALSE_CLAIM_FIELDS,
  PRODUCTION_METADATA_FIELDS,
  parseCanonicalIsoInstant,
  verifyProgrammedStageReceipt,
};