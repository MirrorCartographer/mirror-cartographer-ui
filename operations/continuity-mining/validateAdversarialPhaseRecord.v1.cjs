'use strict';

const CHECKPOINTS = new Set(['pre_commit', 'post_implementation', 'verification']);
const CLAIM_STATUSES = new Set([
  'unresolved',
  'lead_only',
  'collision_rejected',
  'coverage_bounded',
  'verified'
]);

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function nonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

function validateAdversarialPhaseRecord(record) {
  const violations = [];

  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { valid: false, violations: ['record_must_be_object'] };
  }

  if (!CHECKPOINTS.has(record.checkpoint)) violations.push('invalid_checkpoint');
  if (!nonEmptyString(record.target)) violations.push('missing_target');
  if (!nonEmptyArray(record.attacks)) violations.push('missing_attacks');
  if (!Array.isArray(record.findings)) violations.push('findings_must_be_array');
  if (!Array.isArray(record.repairs)) violations.push('repairs_must_be_array');
  if (!Array.isArray(record.remaining_uncertainty)) violations.push('remaining_uncertainty_must_be_array');
  if (!nonEmptyString(record.rollback_route)) violations.push('missing_rollback_route');
  if (!CLAIM_STATUSES.has(record.claim_status_after_review)) violations.push('invalid_claim_status');
  if (typeof record.design_stronger !== 'boolean') violations.push('design_stronger_must_be_boolean');
  if (!nonEmptyString(record.strength_reason)) violations.push('missing_strength_reason');
  if (!nonEmptyString(record.evidence_quality)) violations.push('missing_evidence_quality');
  if (!nonEmptyString(record.next_falsifiable_step)) violations.push('missing_next_falsifiable_step');

  if (record.claim_status_after_review === 'verified') {
    if (record.checkpoint !== 'verification') violations.push('verified_requires_verification_checkpoint');
    if (!nonEmptyArray(record.evidence_inspected)) violations.push('verified_requires_evidence');
    if (!nonEmptyArray(record.negative_controls)) violations.push('verified_requires_negative_controls');
    if (!nonEmptyString(record.claim_boundary)) violations.push('verified_requires_claim_boundary');
    if (record.coverage_class && record.coverage_class !== 'exhaustive') {
      violations.push('verified_requires_exhaustive_coverage_when_coverage_claimed');
    }
  }

  if (record.coverage_class === 'partial' && record.claim_status_after_review === 'verified') {
    violations.push('partial_coverage_cannot_verify');
  }

  if (record.intentional_failure_experiment === true) {
    if (record.experiment_scope !== 'reversible_fixture') violations.push('unsafe_failure_experiment_scope');
    if (record.shared_state_mutated === true) violations.push('failure_experiment_mutated_shared_state');
    if (record.automation_mutated === true) violations.push('failure_experiment_mutated_automation');
    if (record.production_mutated === true) violations.push('failure_experiment_mutated_production');
    if (record.irreversible_user_data_mutated === true) violations.push('failure_experiment_mutated_irreversible_data');
  }

  return {
    valid: violations.length === 0,
    violations
  };
}

module.exports = {
  validateAdversarialPhaseRecord
};
