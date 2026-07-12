import { classifyVercelStatus } from './vercel-provider-status-classifier.mjs';

function parseTime(value) {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

export function evaluateStatusTimeline(statuses, expectedCommit) {
  if (!Array.isArray(statuses) || statuses.length === 0) {
    return { decision: 'hold_unobservable', accepted: false, reason: 'no_statuses' };
  }

  const normalized = statuses.map((status, index) => ({
    index,
    status,
    observedAt: parseTime(status?.observed_at),
    classification: classifyVercelStatus(status)
  }));

  if (normalized.some((entry) => entry.observedAt === null)) {
    return { decision: 'hold_invalid_timeline', accepted: false, reason: 'missing_or_invalid_observed_at' };
  }

  const ordered = [...normalized].sort((a, b) => a.observedAt - b.observedAt || a.index - b.index);
  const latest = ordered.at(-1);
  const latestCommit = latest.status?.commit_sha;

  if (!expectedCommit || latestCommit !== expectedCommit) {
    return {
      decision: 'hold_commit_mismatch',
      accepted: false,
      reason: 'latest_status_not_bound_to_expected_commit',
      latest
    };
  }

  const sameTime = ordered.filter((entry) => entry.observedAt === latest.observedAt);
  const classifications = new Set(sameTime.map((entry) => entry.classification.classification));
  if (classifications.size > 1) {
    return {
      decision: 'hold_conflicting_latest_statuses',
      accepted: false,
      reason: 'same_timestamp_conflict',
      latest
    };
  }

  const classification = latest.classification.classification;
  const decisions = {
    provider_capacity_blocked: 'hold_for_capacity',
    provider_pending: 'hold_for_final_status',
    provider_execution_failed: 'diagnose_before_retry',
    provider_reported_success_unbound: 'require_immutable_binding',
    unknown_vercel_status: 'hold_unobservable',
    unobservable: 'hold_unobservable',
    unrelated_status: 'hold_unobservable'
  };

  return {
    decision: decisions[classification] ?? 'hold_unobservable',
    accepted: false,
    reason: latest.classification.reason,
    latest
  };
}
