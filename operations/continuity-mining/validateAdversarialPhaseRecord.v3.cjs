'use strict';

const CHECKPOINTS = new Set(['pre_commit', 'post_implementation', 'verification']);
const CLAIM_STATUSES = new Set(['unresolved', 'lead_only', 'collision_rejected', 'coverage_bounded', 'verified']);
const COVERAGE_CLASSES = new Set(['unknown', 'partial', 'bounded', 'exhaustive']);
const PLACEHOLDER_ROLLBACKS = new Set(['none', 'n/a', 'na', 'tbd', 'not applicable', 'unknown']);

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function stringArray(value, { nonEmpty = false } = {}) {
  return Array.isArray(value) && (!nonEmpty || value.length > 0) && value.every(nonEmptyString);
}

function validateAdversarialPhaseRecord(record) {
  const violations = [];

  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { valid: false, violations: ['record_must_be_object'] };
  }

  if (record.schema_version !== 3) violations.push('schema_version_must_be_3');
  if (!CHECKPOINTS.has(record.checkpoint)) violations.push('invalid_checkpoint');
  if (!nonEmptyString(record.target)) violations.push('missing_target');
  if (!stringArray(record.attacks, { nonEmpty: true })) violations.push('attacks_must_be_nonempty_strings');
  if (!stringArray(record.findings)) violations.push('findings_must_be_string_array');
  if (!stringArray(record.repairs)) violations.push('repairs_must_be_string_array');
  if (!stringArray(record.remaining_uncertainty)) violations.push('remaining_uncertainty_must_be_string_array');
  if (!nonEmptyString(record.rollback_route)) {
    violations.push('missing_rollback_route');
  } else if (PLACEHOLDER_ROLLBACKS.has(record.rollback_route.trim().toLowerCase())) {
    violations.push('placeholder_rollback_route');
  }
  if (!CLAIM_STATUSES.has(record.claim_status_after_review)) violations.push('invalid_claim_status');
  if (typeof record.design_stronger !== 'boolean') violations.push('design_stronger_must_be_boolean');
  if (!nonEmptyString(record.strength_reason)) violations.push('missing_strength_reason');
  if (!nonEmptyString(record.evidence_quality)) violations.push('missing_evidence_quality');
  if (!nonEmptyString(record.claim_boundary)) violations.push('missing_claim_boundary');
  if (!nonEmptyString(record.next_falsifiable_step)) violations.push('missing_next_falsifiable_step');

  if (!COVERAGE_CLASSES.has(record.coverage_class)) violations.push('invalid_or_missing_coverage_class');

  if (record.design_stronger === true && !stringArray(record.repairs, { nonEmpty: true })) {
    violations.push('stronger_verdict_requires_repair');
  }
  if (record.design_stronger === false && record.repairs_applied === true) {
    violations.push('repair_claim_conflicts_with_not_stronger_verdict');
  }

  if (record.checkpoint === 'verification') {
    if (!stringArray(record.evidence_inspected, { nonEmpty: true })) {
      violations.push('verification_requires_evidence');
    }
    if (!stringArray(record.negative_controls, { nonEmpty: true })) {
      violations.push('verification_requires_negative_controls');
    }
  }

  if (record.claim_status_after_review === 'coverage_bounded') {
    if (!new Set(['partial', 'bounded']).has(record.coverage_class)) {
      violations.push('coverage_bounded_requires_partial_or_bounded_coverage');
    }
    if (!stringArray(record.remaining_uncertainty, { nonEmpty: true })) {
      violations.push('coverage_bounded_requires_uncertainty');
    }
  }

  if (record.claim_status_after_review === 'verified') {
    if (record.checkpoint !== 'verification') violations.push('verified_requires_verification_checkpoint');
    if (record.coverage_class !== 'exhaustive') violations.push('verified_requires_exhaustive_coverage');
    if (stringArray(record.remaining_uncertainty, { nonEmpty: true })) {
      violations.push('verified_cannot_retain_material_uncertainty');
    }
  }

  if (record.intentional_failure_experiment === true) {
    if (record.experiment_scope !== 'reversible_fixture') violations.push('unsafe_failure_experiment_scope');
    if (record.experiment_reversed !== true) violations.push('failure_experiment_must_be_reversed');
    if (!nonEmptyString(record.experiment_evidence)) violations.push('failure_experiment_requires_evidence');
    if (record.shared_state_mutated === true) violations.push('failure_experiment_mutated_shared_state');
    if (record.automation_mutated === true) violations.push('failure_experiment_mutated_automation');
    if (record.production_mutated === true) violations.push('failure_experiment_mutated_production');
    if (record.deployment_mutated === true) violations.push('failure_experiment_mutated_deployment');
    if (record.schedule_mutated === true) violations.push('failure_experiment_mutated_schedule');
    if (record.credentials_mutated === true) violations.push('failure_experiment_mutated_credentials');
    if (record.irreversible_user_data_mutated === true) violations.push('failure_experiment_mutated_irreversible_data');
  } else if (
    record.experiment_scope !== undefined ||
    record.experiment_reversed !== undefined ||
    record.experiment_evidence !== undefined
  ) {
    violations.push('experiment_fields_require_intentional_failure_flag');
  }

  return { valid: violations.length === 0, violations };
}

module.exports = { validateAdversarialPhaseRecord };
