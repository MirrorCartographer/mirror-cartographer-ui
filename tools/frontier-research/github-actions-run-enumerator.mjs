const API_VERSION = '2022-11-28';

function parseNext(linkHeader) {
  if (!linkHeader) return null;
  for (const part of linkHeader.split(',')) {
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/);
    if (match && match[2] === 'next') return match[1];
  }
  return null;
}

export async function enumerateWorkflowRuns({
  owner,
  repo,
  commitSha,
  token,
  fetchImpl = globalThis.fetch,
  apiBase = 'https://api.github.com',
  maxPages = 100
}) {
  if (!owner || !repo || !/^[0-9a-f]{40}$/i.test(commitSha || '')) {
    throw new TypeError('owner, repo, and a full 40-character commitSha are required');
  }
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');

  const first = new URL(`/repos/${owner}/${repo}/actions/runs`, apiBase);
  first.searchParams.set('head_sha', commitSha);
  first.searchParams.set('per_page', '100');

  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': API_VERSION
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let next = first.toString();
  let pagesFetched = 0;
  const runs = [];

  while (next) {
    if (pagesFetched >= maxPages) {
      return {
        complete: false,
        reason: 'page_limit_reached',
        commitSha,
        pagesFetched,
        runs
      };
    }

    const response = await fetchImpl(next, { headers });
    if (!response.ok) {
      return {
        complete: false,
        reason: `http_${response.status}`,
        commitSha,
        pagesFetched,
        runs
      };
    }

    const body = await response.json();
    const pageRuns = Array.isArray(body.workflow_runs) ? body.workflow_runs : [];
    for (const run of pageRuns) {
      if (run?.head_sha === commitSha) runs.push(run);
    }

    pagesFetched += 1;
    next = parseNext(response.headers.get('link'));
  }

  return {
    complete: true,
    reason: 'exhausted_pagination',
    commitSha,
    pagesFetched,
    runs,
    coverage: {
      eventFilterApplied: false,
      headShaFilterApplied: true,
      perPage: 100,
      paginationExhausted: true,
      crossCommitRunsRejected: true
    }
  };
}
