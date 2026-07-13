const SHA40 = /^[0-9a-f]{40}$/;

function assertSha(value) {
  if (!SHA40.test(value ?? '')) {
    throw new Error('commit_sha must be 40 lowercase hex characters');
  }
}

export function classifyConnectorWorkflowObservation(input) {
  if (!input || typeof input !== 'object') throw new TypeError('input must be an object');

  const {
    commit_sha,
    workflow_runs,
    connector_scope = 'pull_request_first_page',
    retrieved_at
  } = input;

  assertSha(commit_sha);
  if (!Array.isArray(workflow_runs)) throw new TypeError('workflow_runs must be an array');
  if (typeof retrieved_at !== 'string' || Number.isNaN(Date.parse(retrieved_at))) {
    throw new Error('retrieved_at must be an ISO-8601 timestamp');
  }

  const seen = new Set();
  for (const run of workflow_runs) {
    if (!run || typeof run !== 'object') throw new TypeError('each workflow run must be an object');
    if (!Number.isSafeInteger(run.id) || run.id <= 0) throw new Error('run.id must be a positive safe integer');
    if (run.head_sha !== commit_sha) throw new Error(`cross-commit workflow run rejected: ${run.id}`);
    if (seen.has(run.id)) throw new Error(`duplicate workflow run id rejected: ${run.id}`);
    seen.add(run.id);
  }

  const exhaustive = connector_scope === 'all_events_exhaustive';
  const observed = workflow_runs.length > 0;

  if (!exhaustive) {
    return {
      schema_version: 1,
      commit_sha,
      retrieved_at,
      connector_scope,
      observed_run_ids: [...seen].sort((a, b) => a - b),
      status: observed ? 'limited_positive_observation' : 'absence_unproven',
      eligible_for_completion_claim: false,
      reason: observed
        ? 'connector_returned_exact_commit_runs_but_scope_is_not_exhaustive'
        : 'zero_results_from_non_exhaustive_connector_scope'
    };
  }

  return {
    schema_version: 1,
    commit_sha,
    retrieved_at,
    connector_scope,
    observed_run_ids: [...seen].sort((a, b) => a - b),
    status: observed ? 'exhaustive_positive_observation' : 'exhaustive_absence_observation',
    eligible_for_completion_claim: observed,
    reason: observed
      ? 'exact_commit_run_observed_under_exhaustive_scope'
      : 'no_exact_commit_run_observed_under_exhaustive_scope'
  };
}
