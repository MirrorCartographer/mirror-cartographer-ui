const REQUIRED_ARTIFACTS = [
  'vercel-audio-route-capability',
  'vercel-exact-commit-manifest'
];

export function evaluateWorkflowObservation(observation, expected = {}) {
  const fail = (decision, reason, details = {}) => ({ accepted: false, decision, reason, ...details });
  if (!observation || typeof observation !== 'object') return fail('hold_unobservable', 'missing_observation');
  if (!observation.observed_at || !Number.isFinite(Date.parse(observation.observed_at))) {
    return fail('hold_invalid_observation', 'missing_or_invalid_observed_at');
  }
  if (!expected.commit_sha || observation.head_sha !== expected.commit_sha) {
    return fail('hold_commit_mismatch', 'workflow_not_bound_to_expected_commit', { observed_head_sha: observation.head_sha ?? null });
  }
  if (expected.workflow_name && observation.workflow_name !== expected.workflow_name) {
    return fail('hold_wrong_workflow', 'unexpected_workflow_name');
  }
  if (observation.status !== 'completed') return fail('hold_for_final_status', 'workflow_not_completed');
  if (observation.conclusion !== 'success') return fail('diagnose_workflow_failure', 'workflow_conclusion_not_success');
  const artifacts = new Set(Array.isArray(observation.artifacts) ? observation.artifacts : []);
  const required = expected.required_artifacts ?? REQUIRED_ARTIFACTS;
  const missing = required.filter((name) => !artifacts.has(name));
  if (missing.length) return fail('hold_missing_artifacts', 'required_artifacts_missing', { missing_artifacts: missing });
  if (!observation.run_id || !observation.run_attempt || !observation.html_url) {
    return fail('hold_unbound_run', 'immutable_run_identity_incomplete');
  }
  return {
    accepted: true,
    decision: 'accept_workflow_observation',
    reason: 'exact_commit_success_with_required_artifacts',
    run_id: observation.run_id,
    run_attempt: observation.run_attempt,
    html_url: observation.html_url,
    head_sha: observation.head_sha,
    artifacts: [...artifacts].sort()
  };
}
