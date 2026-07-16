'use strict';

const { validateAdversarialPhaseRecord } = require('./validateAdversarialPhaseRecord.v3.cjs');

const CHECKPOINT_ORDER = ['pre_commit', 'post_implementation', 'verification'];
const DISPOSITIONS = new Set(['carried', 'repaired', 'rejected']);

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateTransition(transition, fromPhase, toPhase, violations) {
  const expected = `${fromPhase.checkpoint}->${toPhase.checkpoint}`;
  if (!transition || typeof transition !== 'object' || Array.isArray(transition)) {
    violations.push(`missing_transition:${expected}`);
    return;
  }
  if (transition.from !== fromPhase.checkpoint || transition.to !== toPhase.checkpoint) {
    violations.push(`invalid_transition_boundary:${expected}`);
  }
  if (!Array.isArray(transition.uncertainty_dispositions)) {
    violations.push(`missing_uncertainty_dispositions:${expected}`);
    return;
  }

  const dispositions = new Map();
  for (const item of transition.uncertainty_dispositions) {
    if (!item || typeof item !== 'object' || Array.isArray(item) || !nonEmptyString(item.uncertainty)) {
      violations.push(`malformed_uncertainty_disposition:${expected}`);
      continue;
    }
    if (!DISPOSITIONS.has(item.outcome)) violations.push(`invalid_uncertainty_outcome:${expected}`);
    if (!nonEmptyString(item.evidence)) violations.push(`missing_uncertainty_evidence:${expected}`);
    if (dispositions.has(item.uncertainty)) violations.push(`duplicate_uncertainty_disposition:${expected}`);
    dispositions.set(item.uncertainty, item);
  }

  for (const uncertainty of fromPhase.remaining_uncertainty) {
    if (!dispositions.has(uncertainty)) violations.push(`unaccounted_prior_uncertainty:${expected}:${uncertainty}`);
  }

  for (const item of dispositions.values()) {
    if (item.outcome === 'carried' && !toPhase.remaining_uncertainty.includes(item.uncertainty)) {
      violations.push(`carried_uncertainty_missing_from_next_phase:${expected}:${item.uncertainty}`);
    }
    if (item.outcome === 'repaired' && !toPhase.repairs.some((repair) => repair.includes(item.uncertainty))) {
      violations.push(`repaired_uncertainty_missing_repair_trace:${expected}:${item.uncertainty}`);
    }
  }
}

function validateAdversarialCycle(cycle) {
  const violations = [];
  if (!cycle || typeof cycle !== 'object' || Array.isArray(cycle)) {
    return { valid: false, violations: ['cycle_must_be_object'] };
  }
  if (cycle.schema_version !== 1) violations.push('schema_version_must_be_1');
  if (!nonEmptyString(cycle.cycle_id)) violations.push('missing_cycle_id');
  if (!nonEmptyString(cycle.target)) violations.push('missing_cycle_target');
  if (!Array.isArray(cycle.phases) || cycle.phases.length !== 3) {
    violations.push('cycle_requires_exactly_three_phases');
  } else {
    cycle.phases.forEach((phase, index) => {
      const phaseResult = validateAdversarialPhaseRecord(phase);
      for (const violation of phaseResult.violations) violations.push(`phase_${index}:${violation}`);
      if (phase.checkpoint !== CHECKPOINT_ORDER[index]) violations.push(`phase_${index}:checkpoint_out_of_order`);
      if (phase.target !== cycle.target) violations.push(`phase_${index}:target_mismatch`);
    });
    if (new Set(cycle.phases.map((phase) => phase.checkpoint)).size !== 3) violations.push('duplicate_checkpoint');

    if (!Array.isArray(cycle.transitions) || cycle.transitions.length !== 2) {
      violations.push('cycle_requires_two_transitions');
    } else {
      validateTransition(cycle.transitions[0], cycle.phases[0], cycle.phases[1], violations);
      validateTransition(cycle.transitions[1], cycle.phases[1], cycle.phases[2], violations);
    }

    const finalPhase = cycle.phases[2];
    if (finalPhase.claim_status_after_review === 'verified' && finalPhase.coverage_class !== 'exhaustive') {
      violations.push('cycle_verified_requires_exhaustive_final_phase');
    }
  }

  if (!nonEmptyString(cycle.strongest_surviving_claim)) violations.push('missing_strongest_surviving_claim');
  if (!Array.isArray(cycle.rejected_alternatives)) violations.push('rejected_alternatives_must_be_array');
  if (!Array.isArray(cycle.unresolved_risks)) violations.push('unresolved_risks_must_be_array');
  if (!nonEmptyString(cycle.rollback_route)) violations.push('missing_cycle_rollback_route');
  if (!nonEmptyString(cycle.next_falsifiable_step)) violations.push('missing_cycle_next_falsifiable_step');

  return { valid: violations.length === 0, violations };
}

module.exports = { validateAdversarialCycle };
