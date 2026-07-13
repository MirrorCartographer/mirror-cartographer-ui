const SHA_RE = /^[0-9a-f]{40}$/;

function fail(reason, details = {}) {
  return { verified: false, reason, ...details };
}

function exactEntries(searchParams) {
  const values = new Map();
  for (const [key, value] of searchParams.entries()) {
    if (values.has(key)) return { duplicate: key };
    values.set(key, value);
  }
  return { values };
}

export function validateWorkflowPaginationUrl({
  url,
  repository,
  commit_sha,
  expected_page,
  expected_per_page = 100
}) {
  if (typeof repository !== 'string' || !/^[^/]+\/[^/]+$/.test(repository)) return fail('invalid_repository');
  if (!SHA_RE.test(commit_sha ?? '')) return fail('invalid_commit_sha');
  if (!Number.isInteger(expected_page) || expected_page < 1) return fail('invalid_expected_page');
  if (!Number.isInteger(expected_per_page) || expected_per_page < 1 || expected_per_page > 100) {
    return fail('invalid_expected_per_page');
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return fail('invalid_url');
  }

  if (parsed.protocol !== 'https:' || parsed.hostname !== 'api.github.com' || parsed.port) {
    return fail('unexpected_origin', { origin: parsed.origin });
  }
  if (parsed.username || parsed.password) return fail('userinfo_forbidden');
  if (parsed.hash) return fail('fragment_forbidden');

  const expectedPath = `/repos/${repository}/actions/runs`;
  if (parsed.pathname !== expectedPath) return fail('unexpected_path', { observed: parsed.pathname, expected: expectedPath });

  const entries = exactEntries(parsed.searchParams);
  if (entries.duplicate) return fail('duplicate_query_parameter', { parameter: entries.duplicate });

  const allowed = new Set(['head_sha', 'per_page', 'page']);
  for (const key of entries.values.keys()) {
    if (!allowed.has(key)) return fail('unexpected_query_parameter', { parameter: key });
  }
  for (const key of allowed) {
    if (!entries.values.has(key)) return fail('missing_query_parameter', { parameter: key });
  }

  if (entries.values.get('head_sha') !== commit_sha) return fail('commit_filter_mismatch');
  if (entries.values.get('per_page') !== String(expected_per_page)) return fail('per_page_mismatch');
  if (entries.values.get('page') !== String(expected_page)) return fail('page_mismatch');

  const canonical_url = `https://api.github.com${expectedPath}?head_sha=${commit_sha}&per_page=${expected_per_page}&page=${expected_page}`;
  return {
    verified: true,
    reason: 'workflow_pagination_url_verified',
    canonical_url
  };
}

export default validateWorkflowPaginationUrl;
