const SHA_RE = /^[0-9a-f]{40}$/;

function text(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function assessWorkflowObservation(input = {}) {
  const repository = text(input.repository);
  const commitSha = text(input.commit_sha)?.toLowerCase() ?? null;
  const queriedAt = text(input.queried_at);
  const runs = input.workflow_runs;
  const scope = input.query_scope ?? {};

  if (!repository || !repository.includes('/')) {
    return { accepted: false, decision: 'invalid_repository' };
  }
  if (!commitSha || !SHA_RE.test(commitSha)) {
    return { accepted: false, decision: 'invalid_commit_sha' };
  }
  if (!queriedAt || !Number.isFinite(Date.parse(queriedAt))) {
    return { accepted: false, decision: 'invalid_query_time' };
  }
  if (!Array.isArray(runs)) {
    return { accepted: false, decision: 'invalid_run_collection' };
  }

  const eventFilter = text(scope.event_filter);
  const pagination = text(scope.pagination);
  const exhaustiveEvents = scope.exhaustive_events === true;
  const exhaustivePages = scope.exhaustive_pages === true;
  const scopeComplete = exhaustiveEvents && exhaustivePages;

  const normalizedRuns = runs.map((run) => ({
    id: Number.isInteger(run?.id) && run.id > 0 ? run.id : null,
    head_sha: text(run?.head_sha)?.toLowerCase() ?? null,
    event: text(run?.event),
    status: text(run?.status),
    conclusion: run?.conclusion == null ? null : text(run.conclusion),
    html_url: text(run?.html_url)
  }));

  const malformed = normalizedRuns.find((run) => !run.id || !run.head_sha || !SHA_RE.test(run.head_sha));
  if (malformed) {
    return { accepted: false, decision: 'malformed_workflow_run' };
  }

  const mismatched = normalizedRuns.filter((run) => run.head_sha !== commitSha);
  if (mismatched.length) {
    return {
      accepted: false,
      decision: 'commit_mismatch',
      mismatched_run_ids: mismatched.map((run) => run.id)
    };
  }

  if (!scopeComplete) {
    return {
      accepted: true,
      observable: normalizedRuns.length > 0,
      exhaustive: false,
      decision: normalizedRuns.length ? 'runs_observed_under_incomplete_scope' : 'absence_unproven_due_incomplete_scope',
      reason: 'The query did not cover every workflow event and every result page; absence cannot prove non-execution.',
      repository,
      commit_sha: commitSha,
      queried_at: new Date(queriedAt).toISOString(),
      query_scope: {
        event_filter: eventFilter,
        pagination,
        exhaustive_events: exhaustiveEvents,
        exhaustive_pages: exhaustivePages
      },
      workflow_runs: normalizedRuns
    };
  }

  return {
    accepted: true,
    observable: normalizedRuns.length > 0,
    exhaustive: true,
    decision: normalizedRuns.length ? 'runs_observed_under_complete_scope' : 'no_runs_observed_under_complete_scope',
    reason: normalizedRuns.length
      ? 'At least one exact-commit workflow run was observed under complete query coverage.'
      : 'No exact-commit workflow runs were observed under complete query coverage.',
    repository,
    commit_sha: commitSha,
    queried_at: new Date(queriedAt).toISOString(),
    query_scope: {
      event_filter: eventFilter,
      pagination,
      exhaustive_events: exhaustiveEvents,
      exhaustive_pages: exhaustivePages
    },
    workflow_runs: normalizedRuns
  };
}
