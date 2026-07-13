import { assessObservationFreshness } from './frontier-observation-freshness-gate.mjs';

const SHA40 = /^[0-9a-f]{40}$/;

function fail(targetCommitSha, reasons, reconciliation = null, freshness = null) {
  return Object.freeze({
    schema_version: 1,
    target_commit_sha: targetCommitSha,
    accepted: false,
    classification: 'vercel_commit_evidence_unproven',
    reasons: Object.freeze(reasons),
    reconciliation,
    freshness,
    deployment_claim_permitted: false
  });
}

export function assessFreshReconciledVercelEvidence({
  target_commit_sha,
  target_commit_time,
  evaluated_at,
  reconciliation,
  primary_observation,
  independent_observation,
  max_observation_age_ms,
  max_channel_skew_ms
}) {
  if (!SHA40.test(target_commit_sha ?? '')) throw new Error('target_commit_sha invalid');
  if (!reconciliation || typeof reconciliation !== 'object' || Array.isArray(reconciliation)) {
    return fail(target_commit_sha, ['reconciliation_missing']);
  }

  const reconciliationReasons = [];
  if (reconciliation.verified !== true) reconciliationReasons.push('reconciliation_not_verified');
  if (reconciliation.target_commit_sha !== target_commit_sha) reconciliationReasons.push('reconciliation_commit_mismatch');
  if (reconciliation.provider_ceiling_ambiguous === true) reconciliationReasons.push('provider_ceiling_ambiguous');
  if (Array.isArray(reconciliation.reasons) && reconciliation.reasons.length > 0) reconciliationReasons.push('reconciliation_has_reasons');

  if (reconciliationReasons.length > 0) {
    return fail(target_commit_sha, reconciliationReasons, reconciliation);
  }

  const freshness = assessObservationFreshness({
    target_commit_sha,
    target_commit_time,
    evaluated_at,
    max_observation_age_ms,
    max_channel_skew_ms,
    primary: primary_observation,
    independent: independent_observation
  });

  if (!freshness.accepted) {
    return fail(target_commit_sha, ['freshness_gate_rejected', ...freshness.reasons], reconciliation, freshness);
  }

  return Object.freeze({
    schema_version: 1,
    target_commit_sha,
    accepted: true,
    classification: 'fresh_reconciled_commit_observation',
    reasons: Object.freeze([]),
    reconciliation,
    freshness,
    claim_ceiling: 'fresh reconciled observation of exact-commit workflow evidence',
    deployment_claim_permitted: false,
    next_gate: 'commit-bound workflow outcome assessment'
  });
}
