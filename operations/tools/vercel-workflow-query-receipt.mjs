const SHA_RE = /^[0-9a-f]{40}$/;

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isoInstant(value) {
  const text = nonEmptyString(value);
  if (!text) return null;
  const timestamp = Date.parse(text);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

export function createWorkflowQueryReceipt(input = {}) {
  const repository = nonEmptyString(input.repository);
  const commitSha = nonEmptyString(input.commit_sha)?.toLowerCase() ?? null;
  const queriedAt = isoInstant(input.queried_at);
  const runs = input.workflow_runs;

  if (!repository || !repository.includes('/')) {
    return { accepted: false, decision: 'invalid_repository', reason: 'repository must be an owner/name string.' };
  }
  if (!commitSha || !SHA_RE.test(commitSha)) {
    return { accepted: false, decision: 'invalid_commit_sha', reason: 'commit_sha must be an immutable 40-character lowercase hexadecimal SHA.' };
  }
  if (!queriedAt) {
    return { accepted: false, decision: 'invalid_query_time', reason: 'queried_at must be a valid ISO-8601 instant.' };
  }
  if (!Array.isArray(runs)) {
    return { accepted: false, decision: 'invalid_run_collection', reason: 'workflow_runs must be an array.' };
  }

  const normalizedRuns = runs.map((run) => ({
    id: Number.isInteger(run?.id) && run.id > 0 ? run.id : null,
    head_sha: nonEmptyString(run?.head_sha)?.toLowerCase() ?? null,
    name: nonEmptyString(run?.name ?? run?.workflow_name),
    status: nonEmptyString(run?.status),
    conclusion: run?.conclusion == null ? null : nonEmptyString(run.conclusion),
    html_url: nonEmptyString(run?.html_url)
  }));

  const malformed = normalizedRuns.find((run) => !run.id || !run.head_sha || !SHA_RE.test(run.head_sha));
  if (malformed) {
    return { accepted: false, decision: 'malformed_workflow_run', reason: 'Every workflow run requires a positive id and immutable head_sha.' };
  }

  const mismatched = normalizedRuns.filter((run) => run.head_sha !== commitSha);
  if (mismatched.length > 0) {
    return {
      accepted: false,
      decision: 'commit_mismatch',
      reason: `${mismatched.length} workflow run(s) were not bound to the queried commit.`,
      mismatched_run_ids: mismatched.map((run) => run.id)
    };
  }

  if (normalizedRuns.length === 0) {
    return {
      accepted: true,
      observable: false,
      decision: 'no_workflow_runs_observed',
      reason: 'The exact-commit query returned no workflow runs; deployment or test execution is not proven.',
      repository,
      commit_sha: commitSha,
      queried_at: queriedAt,
      workflow_runs: []
    };
  }

  return {
    accepted: true,
    observable: true,
    decision: 'workflow_runs_observed',
    reason: `${normalizedRuns.length} exact-commit workflow run(s) were observed; each run still requires status, conclusion, job, and artifact verification.`,
    repository,
    commit_sha: commitSha,
    queried_at: queriedAt,
    workflow_runs: normalizedRuns
  };
}
