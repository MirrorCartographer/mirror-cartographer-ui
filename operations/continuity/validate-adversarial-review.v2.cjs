'use strict';

const { validateRecord: validateV1 } = require('./validate-adversarial-review.v1.cjs');

const ALLOWED_DECISIONS = new Set(['block', 'adopt', 'publish', 'canonicalize']);
const REQUIRED_IDENTITY_FIELDS = [
  'cycle_id',
  'target_id',
  'target_digest_or_commit',
];
const REQUIRED_EVIDENCE_FIELDS = [
  'type',
  'locator',
  'observed_at',
  'supported_claim',
  'strength',
  'retention_status',
];
const ALLOWED_STRENGTHS = new Set(['lead_only', 'supporting', 'strong', 'conclusive']);
const ALLOWED_RETENTION = new Set(['immutable', 'retained_copy']);

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIsoDate(value) {
  return isNonEmptyString(value) && Number.isFinite(Date.parse(value));
}

function validateEvidenceItem(item, phaseIndex, evidenceIndex) {
  const errors = [];
  const prefix = `phase ${phaseIndex} evidence ${evidenceIndex}`;

  if (!isObject(item)) {
    return [`${prefix} must be an object`];
  }

  for (const field of REQUIRED_EVIDENCE_FIELDS) {
    if (!(field in item)) {
      errors.push(`${prefix} missing required field: ${field}`);
    }
  }

  for (const field of ['type', 'locator', 'supported_claim']) {
    if (field in item && !isNonEmptyString(item[field])) {
      errors.push(`${prefix} field ${field} must be a non-empty string`);
    }
  }

  if ('observed_at' in item && !isIsoDate(item.observed_at)) {
    errors.push(`${prefix} field observed_at must be an ISO-compatible timestamp`);
  }
  if ('strength' in item && !ALLOWED_STRENGTHS.has(item.strength)) {
    errors.push(`${prefix} field strength is unsupported`);
  }
  if ('retention_status' in item && !ALLOWED_RETENTION.has(item.retention_status)) {
    errors.push(`${prefix} field retention_status is unsupported`);
  }

  return errors;
}

function validateRecord(record) {
  const base = validateV1(record);
  const errors = [...base.errors];

  if (!isObject(record)) {
    return { valid: false, errors };
  }

  if (record.schema_version !== 2) {
    errors.push('schema_version must be 2');
  }
  if (!ALLOWED_DECISIONS.has(record.decision)) {
    errors.push('decision must be one of: block, adopt, publish, canonicalize');
  }
  if (!isIsoDate(record.started_at)) {
    errors.push('started_at must be an ISO-compatible timestamp');
  }

  for (const field of REQUIRED_IDENTITY_FIELDS) {
    if (!isNonEmptyString(record[field])) {
      errors.push(`${field} must be a non-empty string`);
    }
  }

  if (!Array.isArray(record.phases)) {
    return { valid: false, errors };
  }

  record.phases.forEach((phase, phaseIndex) => {
    if (!isObject(phase)) return;

    for (const field of REQUIRED_IDENTITY_FIELDS) {
      if (!isNonEmptyString(phase[field])) {
        errors.push(`phase ${phaseIndex} field ${field} must be a non-empty string`);
      } else if (phase[field] !== record[field]) {
        errors.push(`phase ${phaseIndex} field ${field} must match record ${field}`);
      }
    }

    if (!isIsoDate(phase.recorded_at)) {
      errors.push(`phase ${phaseIndex} field recorded_at must be an ISO-compatible timestamp`);
    }

    if (Array.isArray(phase.evidence)) {
      if (phase.evidence.length === 0) {
        errors.push(`phase ${phaseIndex} evidence must contain at least one retained item`);
      }
      phase.evidence.forEach((item, evidenceIndex) => {
        errors.push(...validateEvidenceItem(item, phaseIndex, evidenceIndex));
      });
    }

    if (['adopt', 'publish', 'canonicalize'].includes(record.decision)) {
      const weakEvidence = Array.isArray(phase.evidence)
        ? phase.evidence.some((item) => isObject(item) && item.strength === 'lead_only')
        : false;
      if (weakEvidence) {
        errors.push(`phase ${phaseIndex} contains lead_only evidence incompatible with decision ${record.decision}`);
      }
    }
  });

  return { valid: errors.length === 0, errors };
}

module.exports = {
  ALLOWED_DECISIONS,
  REQUIRED_IDENTITY_FIELDS,
  REQUIRED_EVIDENCE_FIELDS,
  validateEvidenceItem,
  validateRecord,
};
