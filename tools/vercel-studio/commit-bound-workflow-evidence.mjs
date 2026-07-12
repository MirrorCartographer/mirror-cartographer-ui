import { assessWorkflowRunCoverage } from '../frontier-research/github-actions-run-coverage.mjs';

function rejected(commitSha, reason, enumeration) {
  return {
    schema_version: 1,
    commit_sha: commitSha,
    exhaustive: false,
    coverage: {
      all_events: false,
      all_pages: false,
      per_page: null,
      pages_observed: Number(enumeration?.pagesFetched) || 0
    },
    matching_runs: [],
    errors: [reason],
    finding: 'invalid_observation',
    evidence_strength: 'rejected',
    enumeration: {
      complete: Boolean(enumeration?.complete),
      reason: enumeration?.reason || null
    }
  };
}

export function buildCommitBoundWorkflowEvidence({ commitSha, enumeration }) {
  if (!/^[0-9a-f]{40}$/i.test(commitSha || '')) {
    return rejected(commitSha, 'invalid_commit_sha', enumeration);
  }
  if (!enumeration || enumeration.commitSha !== commitSha) {
    return rejected(commitSha, 'enumeration_commit_mismatch', enumeration);
  }
  if (enumeration.complete !== true || enumeration.reason !== 'exhausted_pagination') {
    return rejected(commitSha, `incomplete_enumeration:${enumeration.reason || 'unknown'}`, enumeration);
  }
  if (!enumeration.coverage || enumeration.coverage.eventFilterApplied !== false ||
      enumeration.coverage.headShaFilterApplied !== true || enumeration.coverage.perPage !== 100 ||
      enumeration.coverage.paginationExhausted !== true ||
      enumeration.coverage.crossCommitRunsRejected !== true) {
    return rejected(commitSha, 'enumeration_coverage_contract_failed', enumeration);
  }
  if (!Array.isArray(enumeration.runs)) {
    return rejected(commitSha, 'enumeration_runs_missing', enumeration);
  }

  const assessment = assessWorkflowRunCoverage({
    commitSha,
    pages: [{ workflow_runs: enumeration.runs }],
    query: { all_events: true, all_pages: true, per_page: 100 }
  });

  return {
    ...assessment,
    enumeration: {
      complete: true,
      reason: enumeration.reason,
      pages_fetched: enumeration.pagesFetched,
      run_count: enumeration.runs.length
    }
  };
}
