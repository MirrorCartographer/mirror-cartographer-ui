'use strict';

const { validateAdversarialPhaseRecord: validateV3 } = require('./validateAdversarialPhaseRecord.v3.cjs');

const EVIDENCE_TYPES = new Set(['repository_file','commit','decision_log','test_output','deployment_object','external_source','archive_object']);
const SHA256 = /^[a-f0-9]{64}$/i;
const COMMIT = /^[a-f0-9]{40}$/i;

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validTimestamp(value) {
  return nonEmpty(value) && !Number.isNaN(Date.parse(value));
}

function validateEvidenceItem(item) {
  const violations = [];
  if (!item || typeof item !== 'object' || Array.isArray(item)) return ['evidence_item_must_be_object'];
  if (!EVIDENCE_TYPES.has(item.type)) violations.push('invalid_evidence_type');
  if (!nonEmpty(item.locator)) violations.push('evidence_missing_locator');
  if (!nonEmpty(item.claim_supported)) violations.push('evidence_missing_claim');
  if (!validTimestamp(item.observed_at)) violations.push('evidence_missing_valid_observed_at');
  if (!nonEmpty(item.strength)) violations.push('evidence_missing_strength');
  if (item.digest_sha256 !== undefined && !SHA256.test(item.digest_sha256)) violations.push('invalid_evidence_digest');
  if (item.commit_sha !== undefined && !COMMIT.test(item.commit_sha)) violations.push('invalid_evidence_commit');
  if (item.type === 'commit' && !COMMIT.test(item.commit_sha || '')) violations.push('commit_evidence_requires_commit_sha');
  if (item.immutable !== true && item.retained_copy !== true) violations.push('evidence_must_be_immutable_or_retained');
  return violations;
}

function validateAdversarialPhaseRecord(record) {
  const evidenceLocators = Array.isArray(record?.evidence_inspected)
    ? record.evidence_inspected.map((item) => nonEmpty(item?.locator) ? item.locator : 'invalid evidence item')
    : record?.evidence_inspected;
  const normalized = record && typeof record === 'object'
    ? { ...record, schema_version: 3, evidence_inspected: evidenceLocators }
    : record;
  const base = validateV3(normalized);
  const violations = base.violations.filter((v) => v !== 'schema_version_must_be_3');

  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { valid: false, violations: ['record_must_be_object'] };
  }
  if (record.schema_version !== 4) violations.push('schema_version_must_be_4');

  if (record.checkpoint === 'verification') {
    if (!Array.isArray(record.evidence_inspected) || record.evidence_inspected.length === 0) {
      if (!violations.includes('verification_requires_evidence')) violations.push('verification_requires_evidence');
    } else {
      record.evidence_inspected.forEach((item, index) => {
        validateEvidenceItem(item).forEach((violation) => violations.push(`evidence_${index}_${violation}`));
      });
    }
  }

  if (record.claim_status_after_review === 'verified') {
    const evidence = Array.isArray(record.evidence_inspected) ? record.evidence_inspected : [];
    if (!evidence.some((item) => item && item.immutable === true)) violations.push('verified_requires_immutable_evidence');
    if (evidence.some((item) => item && item.strength === 'lead_only')) violations.push('verified_cannot_rely_on_lead_only_evidence');
  }

  return { valid: violations.length === 0, violations: [...new Set(violations)] };
}

module.exports = { validateAdversarialPhaseRecord, validateEvidenceItem };
