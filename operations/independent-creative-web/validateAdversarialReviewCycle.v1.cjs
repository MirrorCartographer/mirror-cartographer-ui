'use strict';

const { validateAdversarialReviewRecord } = require('./validateAdversarialReviewRecord.v2.cjs');

const REQUIRED_ORDER = ['pre_publication', 'post_implementation', 'verification'];

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateAdversarialReviewCycle(cycle) {
  const errors = [];
  if (!cycle || typeof cycle !== 'object' || Array.isArray(cycle)) {
    return { valid: false, errors: ['cycle_must_be_object'] };
  }

  if (cycle.schema_version !== 1) errors.push('unsupported_cycle_schema_version');
  if (!nonEmptyString(cycle.cycle_id)) errors.push('missing_cycle_id');
  if (!nonEmptyString(cycle.artifact_id)) errors.push('missing_artifact_id');
  if (!Array.isArray(cycle.phases)) {
    return { valid: false, errors: [...errors, 'phases_must_be_array'] };
  }
  if (cycle.phases.length !== REQUIRED_ORDER.length) errors.push('cycle_requires_exactly_three_phases');

  const checkpoints = cycle.phases.map((phase) => phase && phase.checkpoint);
  if (JSON.stringify(checkpoints) !== JSON.stringify(REQUIRED_ORDER)) {
    errors.push('phases_out_of_order_or_missing');
  }
  if (new Set(checkpoints).size !== checkpoints.length) errors.push('duplicate_checkpoint');

  cycle.phases.forEach((phase, index) => {
    const result = validateAdversarialReviewRecord(phase);
    result.errors.forEach((error) => errors.push(`phase_${index + 1}:${error}`));
    if (phase && phase.cycle_id !== cycle.cycle_id) errors.push(`phase_${index + 1}:cycle_id_mismatch`);
    if (phase && phase.artifact_id !== cycle.artifact_id) errors.push(`phase_${index + 1}:artifact_id_mismatch`);
  });

  const verification = cycle.phases[2];
  if (verification && verification.publication_decision === 'publish') {
    const pre = cycle.phases[0];
    const post = cycle.phases[1];
    if (!pre || !post) errors.push('publish_without_complete_prior_phases');
    if ([pre, post].some((phase) => phase && ['weakened', 'blocked'].includes(phase.robustness_verdict))) {
      errors.push('publish_after_nonpassing_prior_phase');
    }
    if (cycle.phases.some((phase) => Array.isArray(phase.remaining_uncertainty) && phase.remaining_uncertainty.some((item) => /critical|publication blocker|unresolved rollback/i.test(item)))) {
      errors.push('publish_with_material_cycle_uncertainty');
    }
  }

  if (cycle.publication_decision !== undefined && verification && cycle.publication_decision !== verification.publication_decision) {
    errors.push('cycle_decision_mismatch');
  }

  return {
    valid: errors.length === 0,
    errors,
    checkpoint_order: checkpoints,
    publication_decision: verification && verification.publication_decision,
    claim_boundary: 'Validates adversarial review cycle completeness, ordering, identity binding, and publication consistency; does not prove implementation behavior or deployment readiness.',
  };
}

module.exports = { validateAdversarialReviewCycle, REQUIRED_ORDER };
