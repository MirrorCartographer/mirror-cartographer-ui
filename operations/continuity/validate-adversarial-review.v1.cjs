'use strict';

const REQUIRED_CHECKPOINTS = [
  'before_knowledge_commit',
  'post_implementation',
  'verification',
];

const REQUIRED_FIELDS = [
  'checkpoint',
  'claim_or_design_tested',
  'challenge_method',
  'evidence',
  'failures_or_counterexamples_found',
  'repairs_made',
  'remaining_uncertainty',
  'robustness_increased',
  'evidence_quality',
  'rollback_route',
  'next_falsifiable_step',
];

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function fieldExists(object, field) {
  return Object.prototype.hasOwnProperty.call(object, field);
}

function validateRecord(record) {
  const errors = [];

  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { valid: false, errors: ['record must be an object'] };
  }
  if (!Array.isArray(record.phases)) {
    return { valid: false, errors: ['phases must be an array'] };
  }
  if (record.phases.length !== REQUIRED_CHECKPOINTS.length) {
    errors.push('exactly three adversarial phases are required');
  }

  record.phases.forEach((phase, index) => {
    if (!phase || typeof phase !== 'object' || Array.isArray(phase)) {
      errors.push(`phase ${index} must be an object`);
      return;
    }

    for (const field of REQUIRED_FIELDS) {
      if (!(field in phase)) {
        errors.push(`phase ${index} missing required field: ${field}`);
      }
    }

    if (phase.checkpoint !== REQUIRED_CHECKPOINTS[index]) {
      errors.push(`phase ${index} checkpoint must be ${REQUIRED_CHECKPOINTS[index]}`);
    }

    for (const field of [
      'claim_or_design_tested',
      'challenge_method',
      'evidence_quality',
      'rollback_route',
      'next_falsifiable_step',
    ]) {
      if (field in phase && !isNonEmptyString(phase[field])) {
        errors.push(`phase ${index} field ${field} must be a non-empty string`);
      }
    }

    for (const field of [
      'evidence',
      'failures_or_counterexamples_found',
      'repairs_made',
      'remaining_uncertainty',
    ]) {
      if (field in phase && !Array.isArray(phase[field])) {
        errors.push(`phase ${index} field ${field} must be an array`);
      }
    }

    if (
      fieldExists(phase, 'robustness_increased') &&
      typeof phase.robustness_increased !== 'boolean'
    ) {
      errors.push(`phase ${index} field robustness_increased must be boolean`);
    }
  });

  const checkpoints = record.phases.map((phase) => phase && phase.checkpoint);
  if (new Set(checkpoints).size !== checkpoints.length) {
    errors.push('checkpoint values must be unique');
  }

  if (['adopt', 'publish', 'canonicalize'].includes(record.decision)) {
    record.phases.forEach((phase, index) => {
      if (
        phase &&
        Array.isArray(phase.remaining_uncertainty) &&
        phase.remaining_uncertainty.length > 0
      ) {
        errors.push(
          `phase ${index} retains uncertainty incompatible with decision ${record.decision}`
        );
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  REQUIRED_CHECKPOINTS,
  REQUIRED_FIELDS,
  validateRecord,
};
