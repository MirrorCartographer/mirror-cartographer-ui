'use strict';

const CHECKPOINTS = new Set(['pre_publication', 'post_implementation', 'verification']);
const VERDICTS = new Set(['stronger', 'unchanged_with_bounded_uncertainty', 'weakened', 'blocked']);
const PROTECTED_SCOPE_TOKENS = [
  'automation', 'schedule', 'shared state', 'production', 'deployment', 'dns',
  'credential', 'irreversible user data', 'repository history', 'live user data',
];

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function stringArray(value, allowEmpty = true) {
  return Array.isArray(value) && (allowEmpty || value.length > 0) && value.every(nonEmptyString);
}

function normalizeScope(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_./\\-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function protectedScopeMatch(scope) {
  const normalized = normalizeScope(scope);
  return PROTECTED_SCOPE_TOKENS.find((token) => normalized.includes(token)) || null;
}

function validCommitEvidence(entry, artifactCommit) {
  return entry && typeof entry === 'object' && !Array.isArray(entry) &&
    nonEmptyString(entry.commit_sha) && entry.commit_sha === artifactCommit &&
    nonEmptyString(entry.locator) && nonEmptyString(entry.claim) &&
    nonEmptyString(entry.observed_at);
}

function validateAdversarialReviewRecord(record) {
  const errors = [];
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { valid: false, errors: ['record_must_be_object'] };
  }

  if (record.schema_version !== 2) errors.push('unsupported_schema_version');
  if (!CHECKPOINTS.has(record.checkpoint)) errors.push('invalid_checkpoint');
  if (!nonEmptyString(record.claim_or_design)) errors.push('missing_claim_or_design');
  if (!nonEmptyString(record.challenge_method)) errors.push('missing_challenge_method');
  if (!stringArray(record.evidence, false)) errors.push('evidence_requires_nonempty_strings');
  if (!stringArray(record.findings)) errors.push('findings_require_strings');
  if (!stringArray(record.repairs)) errors.push('repairs_require_strings');
  if (!stringArray(record.remaining_uncertainty)) errors.push('remaining_uncertainty_requires_strings');
  if (!nonEmptyString(record.rollback_route)) errors.push('missing_rollback_route');
  if (!VERDICTS.has(record.robustness_verdict)) errors.push('invalid_robustness_verdict');
  if (!nonEmptyString(record.next_falsifiable_step)) errors.push('missing_next_falsifiable_step');

  const decision = record.publication_decision;
  if (record.checkpoint === 'verification' && !['publish', 'block'].includes(decision)) {
    errors.push('verification_requires_publication_decision');
  } else if (record.checkpoint !== 'verification' && decision === 'publish') {
    errors.push('publish_only_allowed_at_verification');
  }

  const experiment = record.intentional_failure_experiment;
  if (experiment !== undefined) {
    if (!experiment || typeof experiment !== 'object' || Array.isArray(experiment)) {
      errors.push('experiment_must_be_object');
    } else {
      if (experiment.reversible !== true) errors.push('experiment_not_reversible');
      if (experiment.isolated !== true) errors.push('experiment_not_isolated');
      if (experiment.restored !== true) errors.push('experiment_not_restored');
      if (!nonEmptyString(experiment.scope)) errors.push('experiment_missing_scope');
      const protectedToken = protectedScopeMatch(experiment.scope);
      if (protectedToken) errors.push(`forbidden_experiment_scope:${protectedToken}`);
    }
  }

  if (record.robustness_verdict === 'stronger' && !stringArray(record.repairs, false)) {
    errors.push('stronger_verdict_requires_repair');
  }
  if (record.robustness_verdict === 'unchanged_with_bounded_uncertainty' && !stringArray(record.remaining_uncertainty, false)) {
    errors.push('bounded_uncertainty_verdict_requires_uncertainty');
  }

  if (decision === 'publish') {
    if (!nonEmptyString(record.artifact_commit)) errors.push('publish_without_artifact_commit');
    if (record.critical_risks_remaining !== 0) errors.push('publish_with_critical_risks');
    if (record.safe_experiments_reversed !== true) errors.push('publish_without_reversed_experiments');
    if (record.robustness_verdict === 'weakened' || record.robustness_verdict === 'blocked') {
      errors.push('publish_with_nonpassing_verdict');
    }
    if (!Array.isArray(record.commit_matched_evidence) || record.commit_matched_evidence.length === 0) {
      errors.push('publish_without_commit_matched_evidence');
    } else if (!record.commit_matched_evidence.every((entry) => validCommitEvidence(entry, record.artifact_commit))) {
      errors.push('invalid_or_commit_mismatched_evidence');
    }
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  validateAdversarialReviewRecord,
  normalizeScope,
  protectedScopeMatch,
  PROTECTED_SCOPE_TOKENS,
};
