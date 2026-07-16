'use strict';

const { validateRecord: validateV1 } = require('./validate-adversarial-review.v1.cjs');

const ALLOWED_DECISIONS = new Set(['block', 'adopt', 'publish', 'canonicalize']);
const COLLECTION_FIELDS = [
  'evidence',
  'failures_or_counterexamples_found',
  'repairs_made',
  'remaining_uncertainty',
  'evidence_required_before_publication',
];

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateStringArray(value, label, errors, { allowEmpty = true } = {}) {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array`);
    return;
  }
  if (!allowEmpty && value.length === 0) {
    errors.push(`${label} must contain at least one item`);
  }
  value.forEach((item, index) => {
    if (!isNonEmptyString(item)) {
      errors.push(`${label}[${index}] must be a non-empty string`);
    }
  });
}

function validateRecord(record) {
  const base = validateV1(record);
  const errors = [...base.errors];

  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { valid: false, errors };
  }

  if (!ALLOWED_DECISIONS.has(record.decision)) {
    errors.push('decision must be one of: block, adopt, publish, canonicalize');
  }

  if (!Array.isArray(record.phases)) {
    return { valid: false, errors };
  }

  record.phases.forEach((phase, phaseIndex) => {
    if (!phase || typeof phase !== 'object' || Array.isArray(phase)) return;

    if (!Object.prototype.hasOwnProperty.call(phase, 'evidence_required_before_publication')) {
      errors.push(`phase ${phaseIndex} missing required field: evidence_required_before_publication`);
    }

    for (const field of COLLECTION_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(phase, field)) continue;
      validateStringArray(
        phase[field],
        `phase ${phaseIndex} field ${field}`,
        errors,
        { allowEmpty: field !== 'evidence' }
      );
    }
  });

  if (['adopt', 'publish', 'canonicalize'].includes(record.decision)) {
    record.phases.forEach((phase, phaseIndex) => {
      if (
        phase &&
        Array.isArray(phase.evidence_required_before_publication) &&
        phase.evidence_required_before_publication.length > 0
      ) {
        errors.push(
          `phase ${phaseIndex} retains evidence requirements incompatible with decision ${record.decision}`
        );
      }
    });
  }

  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

module.exports = {
  ALLOWED_DECISIONS,
  COLLECTION_FIELDS,
  validateRecord,
};
