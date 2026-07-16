'use strict';

const { validateAdversarialReviewCycle: validateV1 } = require('./validateAdversarialReviewCycle.v1.cjs');

function validateAdversarialReviewCycle(cycle) {
  const base = validateV1(cycle);
  const errors = [...base.errors];

  if (cycle && Array.isArray(cycle.phases)) {
    const verification = cycle.phases[2];
    if (verification && verification.publication_decision === 'publish') {
      cycle.phases.slice(0, 2).forEach((phase, index) => {
        if (phase && phase.publication_decision === 'block') {
          errors.push(`phase_${index + 1}:publish_after_explicit_prior_block`);
        }
      });
    }
  }

  return {
    ...base,
    valid: errors.length === 0,
    errors,
    claim_boundary: 'Validates v1 cycle structure plus semantic consistency of prior publication decisions; does not prove implementation behavior, test execution, or deployment readiness.',
  };
}

module.exports = { validateAdversarialReviewCycle };
