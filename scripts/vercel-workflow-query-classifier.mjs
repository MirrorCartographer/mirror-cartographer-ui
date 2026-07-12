export function classifyWorkflowQueryResult(result, expected = {}) {
  const fail = (decision, reason, details = {}) => ({
    observable: false,
    decision,
    reason,
    ...details
  });

  if (!result || typeof result !== 'object') {
    return fail('hold_invalid_query_result', 'missing_query_result');
  }

  if (!expected.commit_sha || typeof expected.commit_sha !== 'string') {
    return fail('hold_invalid_expectation', 'missing_expected_commit_sha');
  }

  if (!Array.isArray(result.workflow_runs)) {
    return fail('hold_invalid_query_result', 'workflow_runs_not_array');
  }

  if (result.workflow_runs.length === 0) {
    return fail('hold_unobserved', 'no_workflow_runs_returned', {
      expected_commit_sha: expected.commit_sha,
      query_scope: expected.query_scope ?? 'unknown',
      limitation: expected.query_limitation ?? null
    });
  }

  const matching = result.workflow_runs.filter((run) => run && run.head_sha === expected.commit_sha);
  if (matching.length === 0) {
    return fail('hold_commit_unobserved', 'returned_runs_do_not_match_expected_commit', {
      expected_commit_sha: expected.commit_sha,
      observed_head_shas: [...new Set(result.workflow_runs.map((run) => run?.head_sha ?? null))]
    });
  }

  const ordered = [...matching].sort((a, b) => {
    const aTime = Date.parse(a.updated_at ?? a.created_at ?? '');
    const bTime = Date.parse(b.updated_at ?? b.created_at ?? '');
    return (Number.isFinite(bTime) ? bTime : -Infinity) - (Number.isFinite(aTime) ? aTime : -Infinity);
  });

  const latest = ordered[0];
  if (expected.workflow_name && latest.name !== expected.workflow_name && latest.workflow_name !== expected.workflow_name) {
    return fail('hold_wrong_workflow', 'latest_matching_run_has_unexpected_workflow', {
      observed_workflow_name: latest.name ?? latest.workflow_name ?? null
    });
  }

  return {
    observable: true,
    decision: 'inspect_workflow_run',
    reason: 'matching_commit_run_returned',
    expected_commit_sha: expected.commit_sha,
    run: latest
  };
}
