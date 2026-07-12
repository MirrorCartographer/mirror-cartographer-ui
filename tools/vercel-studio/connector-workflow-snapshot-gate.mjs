export function assessConnectorWorkflowSnapshot({ commitSha, workflowRuns, transport }) {
  const errors = [];
  if (!/^[0-9a-f]{40}$/i.test(commitSha || '')) errors.push('invalid_commit_sha');
  if (!Array.isArray(workflowRuns)) errors.push('workflow_runs_missing');

  const normalized = Array.isArray(workflowRuns) ? workflowRuns.map((run) => ({
    id: run?.id ?? null,
    head_sha: run?.head_sha ?? null,
    event: run?.event ?? null,
    status: run?.status ?? null,
    conclusion: run?.conclusion ?? null,
    html_url: run?.html_url ?? null
  })) : [];

  const crossCommit = normalized.filter((run) => run.head_sha && run.head_sha !== commitSha);
  if (crossCommit.length) errors.push('cross_commit_contamination');

  const matchingRuns = normalized.filter((run) => run.head_sha === commitSha);
  const contract = {
    authenticated: Boolean(transport?.authenticated),
    event_scope: transport?.event_scope || 'unknown',
    pagination_scope: transport?.pagination_scope || 'unknown',
    provider: transport?.provider || 'unknown'
  };

  const exhaustive = contract.authenticated === true &&
    contract.event_scope === 'all_events' &&
    contract.pagination_scope === 'all_pages';

  if (exhaustive) errors.push('connector_snapshot_must_use_exhaustive_enumerator');

  return {
    schema_version: 1,
    commit_sha: commitSha,
    source_class: 'connector_snapshot',
    exhaustive: false,
    transport: contract,
    matching_runs: matchingRuns,
    errors,
    finding: errors.length
      ? 'invalid_observation'
      : matchingRuns.length
        ? 'runs_observed_limited'
        : 'absence_unproven',
    evidence_strength: errors.length ? 'rejected' : 'limited',
    handoff: 'Use tools/frontier-research/github-actions-run-enumerator.mjs and tools/vercel-studio/commit-bound-workflow-evidence.mjs for exhaustive evidence.'
  };
}
