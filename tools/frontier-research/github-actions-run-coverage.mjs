export function assessWorkflowRunCoverage({commitSha, pages, query}) {
  const errors = [];
  if (!/^[0-9a-f]{40}$/i.test(commitSha || '')) errors.push('invalid_commit_sha');
  if (!Array.isArray(pages) || pages.length === 0) errors.push('missing_pages');
  const normalized = (pages || []).flatMap((page, pageIndex) => {
    if (!Array.isArray(page?.workflow_runs)) {
      errors.push(`malformed_page:${pageIndex + 1}`);
      return [];
    }
    return page.workflow_runs.map(run => ({
      id: run?.id,
      head_sha: run?.head_sha,
      event: run?.event,
      status: run?.status,
      conclusion: run?.conclusion,
      html_url: run?.html_url
    }));
  });
  const crossCommit = normalized.filter(run => run.head_sha !== commitSha);
  if (crossCommit.length) errors.push('cross_commit_contamination');
  const matching = normalized.filter(run => run.head_sha === commitSha);
  const exhaustive = Boolean(query?.all_events) && Boolean(query?.all_pages) && Number(query?.per_page) === 100;
  return {
    schema_version: 1,
    commit_sha: commitSha,
    exhaustive,
    coverage: {
      all_events: Boolean(query?.all_events),
      all_pages: Boolean(query?.all_pages),
      per_page: Number(query?.per_page) || null,
      pages_observed: Array.isArray(pages) ? pages.length : 0
    },
    matching_runs: matching,
    errors,
    finding: errors.length ? 'invalid_observation' : matching.length ? 'runs_observed' : exhaustive ? 'no_runs_observed_exhaustively' : 'absence_unproven',
    evidence_strength: errors.length ? 'rejected' : exhaustive ? 'strong' : 'limited'
  };
}
