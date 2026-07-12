const SHA40 = /^[0-9a-f]{40}$/i;

function fail(reason, extra = {}) {
  return { complete: false, reason, ...extra };
}

function normalizeRun(run) {
  if (!run || !Number.isInteger(run.id) || run.id <= 0) {
    throw new TypeError('workflow run id must be a positive integer');
  }
  return {
    id: run.id,
    head_sha: run.head_sha ?? null,
    event: run.event ?? null,
    status: run.status ?? null,
    conclusion: run.conclusion ?? null,
    workflow_id: run.workflow_id ?? null,
    run_attempt: run.run_attempt ?? null
  };
}

export function buildGhPaginatedWorkflowEnvelope({ pages, commitSha, command }) {
  if (!SHA40.test(commitSha || '')) throw new TypeError('a full 40-character commitSha is required');
  if (!Array.isArray(pages) || pages.length === 0) return fail('missing_paginated_pages', { commitSha });
  if (typeof command !== 'string' || !command.includes('--paginate') || !command.includes('--slurp')) {
    return fail('non_exhaustive_command_contract', { commitSha });
  }

  const runs = [];
  const seen = new Set();
  let declaredTotal = null;

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    if (!page || !Number.isInteger(page.total_count) || !Array.isArray(page.workflow_runs)) {
      return fail('invalid_page_shape', { commitSha, pageIndex });
    }
    if (declaredTotal === null) declaredTotal = page.total_count;
    if (page.total_count !== declaredTotal) {
      return fail('total_count_changed_during_traversal', { commitSha, pageIndex, declaredTotal, observedTotal: page.total_count });
    }
    for (const raw of page.workflow_runs) {
      const run = normalizeRun(raw);
      if (run.head_sha !== commitSha) return fail('cross_commit_record', { commitSha, pageIndex, offendingRun: run });
      if (seen.has(run.id)) return fail('duplicate_run_id', { commitSha, pageIndex, offendingRun: run });
      seen.add(run.id);
      runs.push(run);
    }
  }

  if (declaredTotal >= 1000) {
    return fail('provider_ceiling_ambiguity', { commitSha, declaredTotal, observedCount: runs.length });
  }
  if (runs.length !== declaredTotal) {
    return fail('pagination_count_mismatch', { commitSha, declaredTotal, observedCount: runs.length });
  }

  runs.sort((a, b) => a.id - b.id);
  return {
    complete: true,
    reason: 'gh_paginate_slurp_complete',
    source: 'gh_api_paginate_slurp',
    commitSha,
    declaredTotal,
    pageCount: pages.length,
    command,
    runs
  };
}
