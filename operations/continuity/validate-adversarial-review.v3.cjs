'use strict';

const { validateRecord: validateV2 } = require('./validate-adversarial-review.v2.cjs');

const ALLOWED_CHALLENGE_OUTCOMES = new Set([
  'stronger_supporting_evidence',
  'refined_design',
  'documented_unresolved_question',
  'safer_reversible_alternative',
]);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateStringArray(value, label, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array`);
    return;
  }
  value.forEach((item, index) => {
    if (!isNonEmptyString(item)) {
      errors.push(`${label}[${index}] must be a non-empty string`);
    }
  });
}

function validateRecord(record) {
  const base = validateV2(record);
  const errors = [...base.errors];

  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { valid: false, errors: [...new Set(errors)] };
  }

  if (!isNonEmptyString(record.strongest_surviving_proposal)) {
    errors.push('strongest_surviving_proposal must be a non-empty string');
  }
  if (!isNonEmptyString(record.next_falsifiable_step)) {
    errors.push('next_falsifiable_step must be a non-empty string');
  }

  validateStringArray(record.rejected_alternatives, 'rejected_alternatives', errors);
  validateStringArray(record.unresolved_risks, 'unresolved_risks', errors);

  if (Array.isArray(record.phases)) {
    record.phases.forEach((phase, phaseIndex) => {
      if (!phase || typeof phase !== 'object' || Array.isArray(phase)) return;

      if (!ALLOWED_CHALLENGE_OUTCOMES.has(phase.challenge_outcome)) {
        errors.push(
          `phase ${phaseIndex} challenge_outcome must be one of: ${[
            ...ALLOWED_CHALLENGE_OUTCOMES,
          ].join(', ')}`
        );
        return;
      }

      if (
        phase.challenge_outcome === 'refined_design' &&
        (!Array.isArray(phase.repairs_made) || phase.repairs_made.length === 0)
      ) {
        errors.push(`phase ${phaseIndex} refined_design outcome requires at least one repair`);
      }

      if (
        phase.challenge_outcome === 'documented_unresolved_question' &&
        (!Array.isArray(phase.remaining_uncertainty) || phase.remaining_uncertainty.length === 0)
      ) {
        errors.push(
          `phase ${phaseIndex} documented_unresolved_question outcome requires remaining uncertainty`
        );
      }

      if (
        phase.challenge_outcome === 'stronger_supporting_evidence' &&
        (!Array.isArray(phase.evidence) || phase.evidence.length === 0)
      ) {
        errors.push(
          `phase ${phaseIndex} stronger_supporting_evidence outcome requires retained evidence`
        );
      }

      if (
        phase.challenge_outcome === 'safer_reversible_alternative' &&
        !isNonEmptyString(phase.rollback_route)
      ) {
        errors.push(
          `phase ${phaseIndex} safer_reversible_alternative outcome requires a rollback route`
        );
      }
    });
  }

  if (
    ['adopt', 'publish', 'canonicalize'].includes(record.decision) &&
    Array.isArray(record.unresolved_risks) &&
    record.unresolved_risks.length > 0
  ) {
    errors.push(`unresolved_risks are incompatible with decision ${record.decision}`);
  }

  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

module.exports = {
  ALLOWED_CHALLENGE_OUTCOMES,
  validateRecord,
};
