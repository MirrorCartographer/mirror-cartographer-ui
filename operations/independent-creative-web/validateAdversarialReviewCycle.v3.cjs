'use strict';

const { validateAdversarialReviewCycle: validateV2 } = require('./validateAdversarialReviewCycle.v2.cjs');

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateAdversarialReviewCycle(cycle) {
  const base = validateV2(cycle);
  const errors = [...base.errors];

  if (cycle && Array.isArray(cycle.phases)) {
    const verification = cycle.phases[2];
    if (verification && verification.publication_decision === 'publish') {
      cycle.phases.forEach((phase, index) => {
        if (phase && Array.isArray(phase.remaining_uncertainty) && phase.remaining_uncertainty.length > 0) {
          errors.push(`phase_${index + 1}:publish_with_remaining_uncertainty`);
        }

        if (phase && phase.evidence_required_before_publication !== undefined) {
          if (!Array.isArray(phase.evidence_required_before_publication) ||
              !phase.evidence_required_before_publication.every(nonEmptyString)) {
            errors.push(`phase_${index + 1}:invalid_evidence_required_before_publication`);
          } else if (phase.evidence_required_before_publication.length > 0) {
            errors.push(`phase_${index + 1}:publish_with_outstanding_evidence_requirement`);
          }
        }
      });
    }
  }

  return {
    ...base,
    valid: errors.length === 0,
    errors,
    claim_boundary: 'Validates v2 cycle structure and publication-decision consistency, and prevents publication while any checkpoint retains uncertainty or an explicit evidence requirement; does not prove implementation behavior, test execution, provider state, or deployment readiness.',
  };
}

module.exports = { validateAdversarialReviewCycle };
