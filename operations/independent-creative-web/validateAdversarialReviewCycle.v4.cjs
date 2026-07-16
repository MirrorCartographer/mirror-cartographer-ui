'use strict';

const { validateAdversarialReviewCycle: validateV3 } = require('./validateAdversarialReviewCycle.v3.cjs');

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateAdversarialReviewCycle(cycle) {
  const base = validateV3(cycle);
  const errors = [...base.errors];

  if (cycle && Array.isArray(cycle.phases)) {
    cycle.phases.forEach((phase, index) => {
      if (!phase || !Array.isArray(phase.evidence_required_before_publication) ||
          !phase.evidence_required_before_publication.every(nonEmptyString)) {
        const error = `phase_${index + 1}:invalid_evidence_required_before_publication`;
        if (!errors.includes(error)) errors.push(error);
      }
    });
  }

  return {
    ...base,
    valid: errors.length === 0,
    errors,
    claim_boundary: 'Validates v3 publication-cycle controls and requires every checkpoint, including blocked cycles, to retain an explicit evidence-required-before-publication inventory; does not prove implementation behavior, test execution, provider state, or deployment readiness.',
  };
}

module.exports = { validateAdversarialReviewCycle };
