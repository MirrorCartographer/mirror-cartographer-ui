'use strict';

const COMMIT_SHA = /^[0-9a-f]{40}$/i;
const ALLOWED_QUERY_KEYS = new Set(['head_sha', 'per_page', 'page']);

function validateGitHubWorkflowPaginationUrl(urlText, context = {}) {
  const reasons = [];
  const exactCommit = String(context.exact_commit || '');
  const repository = String(context.repository || '');
  const [owner, repo, extra] = repository.split('/');

  if (!COMMIT_SHA.test(exactCommit)) reasons.push('invalid_exact_commit');
  if (!owner || !repo || extra) reasons.push('invalid_repository');

  let url = null;
  try { url = new URL(urlText); }
  catch { reasons.push('invalid_url'); }

  if (url) {
    if (url.protocol !== 'https:') reasons.push('non_https_url');
    if (url.hostname !== 'api.github.com' || url.port) reasons.push('unexpected_api_origin');
    if (url.username || url.password) reasons.push('userinfo_forbidden');
    if (url.hash) reasons.push('fragment_forbidden');

    const expectedPath = owner && repo && !extra ? `/repos/${owner}/${repo}/actions/runs` : null;
    if (!expectedPath || url.pathname.toLowerCase() !== expectedPath.toLowerCase()) reasons.push('unexpected_endpoint_path');

    const keys = [...new Set(url.searchParams.keys())];
    for (const key of keys) {
      if (!ALLOWED_QUERY_KEYS.has(key)) reasons.push(`unsupported_query_parameter_${key}`);
      if (url.searchParams.getAll(key).length !== 1) reasons.push(`duplicate_query_parameter_${key}`);
    }

    if (url.searchParams.get('head_sha') !== exactCommit) reasons.push('exact_commit_filter_mismatch');
    if (url.searchParams.get('per_page') !== '100') reasons.push('per_page_not_100');

    const pageText = url.searchParams.get('page');
    if (pageText !== null && (!/^[1-9][0-9]*$/.test(pageText) || Number(pageText) > Number.MAX_SAFE_INTEGER)) {
      reasons.push('invalid_page_number');
    }
  }

  return {
    schema_version: 1,
    classification: reasons.length ? 'rejected' : 'validated_github_workflow_pagination_url',
    verified: reasons.length === 0,
    reasons: [...new Set(reasons)],
    exact_commit: exactCommit || null,
    repository: repository || null,
    normalized_url: url ? url.href : null,
    trust_boundary: reasons.length ? 'untrusted' : 'github_api_exact_commit_actions_runs'
  };
}

module.exports = { validateGitHubWorkflowPaginationUrl };
