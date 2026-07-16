'use strict';

const CHECKPOINTS = new Set([
  'pre_publication',
  'post_implementation',
  'verification',
]);

const VERDICTS = new Set([
  'stronger',
  'unchanged_with_bounded_uncertainty',
  'weakened',
  'blocked',
]);

const FORBIDDEN_EXPERIMENT_SCOPES = [
  'automation',
  'schedule',
  'shared_state',
  'production',
  'dns',
  'credential',
  'irreversible_user_data',
  'repository_history',
];

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function nonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

function validateAdversarialReviewRecord(record) {
  const errors = [];

  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { valid: false, errors: ['record_must_be_object'] };
  }

  if (record.schema_version !== 1) errors.push('unsupported_schema_version');
  if (!CHECKPOINTS.has(record.checkpoint)) errors.push('invalid_checkpoint');
  if (!nonEmptyString(record.claim_or_design)) errors.push('missing_claim_or_design');
  if (!nonEmptyString(record.challenge_method)) errors.push('missing_challenge_method');
  if (!nonEmptyArray(record.evidence)) errors.push('missing_evidence');
  if (!Array.isArray(record.findings)) errors.push('findings_must_be_array');
  if (!Array.isArray(record.repairs)) errors.push('repairs_must_be_array');
  if (!Array.isArray(record.remaining_uncertainty)) errors.push('remaining_uncertainty_must_be_array');
  if (!nonEmptyString(record.rollback_route)) errors.push('missing_rollback_route');
  if (!VERDICTS.has(record.robustness_verdict)) errors.push('invalid_robustness_verdict');
  if (!nonEmptyString(record.next_falsifiable_step)) errors.push('missing_next_falsifiable_step');

  const publicationDecision = record.publication_decision;
  if (record.checkpoint === 'verification') {
    if (!['publish', 'block'].includes(publicationDecision)) {
      errors.push('verification_requires_publication_decision');
    }
  } else if (publicationDecision === 'publish') {
    errors.push('publish_only_allowed_at_verification');
  }

  if (publicationDecision === 'publish') {
    if (record.robustness_verdict === 'weakened' || record.robustness_verdict === 'blocked') {
      errors.push('publish_with_nonpassing_verdict');
    }
    if (record.critical_risks_remaining !== 0) {
      errors.push('publish_with_critical_risks');
    }
    if (!nonEmptyArray(record.commit_matched_evidence)) {
      errors.push('publish_without_commit_matched_evidence');
    }
    if (record.safe_experiments_reversed !== true) {
      errors.push('publish_without_reversed_experiments');
    }
  }

  if (record.intentional_failure_experiment) {
    const experiment = record.intentional_failure_experiment;
    if (experiment.reversible !== true) errors.push('experiment_not_reversible');
    if (experiment.isolated !== true) errors.push('experiment_not_isolated');
    if (experiment.restored !== true) errors.push('experiment_not_restored');
    if (!nonEmptyString(experiment.scope)) errors.push('experiment_missing_scope');
    if (FORBIDDEN_EXPERIMENT_SCOPES.includes(experiment.scope)) {
      errors.push('forbidden_experiment_scope');
    }
  }

  if (record.robustness_verdict === 'stronger' && !nonEmptyArray(record.repairs)) {
    errors.push('stronger_verdict_requires_repair');
  }

  if (record.robustness_verdict === 'unchanged_with_bounded_uncertainty' && !nonEmptyArray(record.remaining_uncertainty)) {
    errors.push('bounded_uncertainty_verdict_requires_uncertainty');
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  validateAdversarialReviewRecord,
  CHECKPOINTS,
  VERDICTS,
};
