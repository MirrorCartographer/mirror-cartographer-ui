'use strict';

const API_VERSION = /^\d{4}-\d{2}-\d{2}$/;

function normalizeHeaderEntries(entries) {
  if (!Array.isArray(entries)) return { map: new Map(), reasons: ['headers_not_entry_array'] };
  const map = new Map();
  const reasons = [];
  for (const entry of entries) {
    if (!Array.isArray(entry) || entry.length !== 2) {
      reasons.push('invalid_header_entry');
      continue;
    }
    const name = String(entry[0] || '').trim().toLowerCase();
    const value = String(entry[1] || '').trim();
    if (!name) {
      reasons.push('empty_header_name');
      continue;
    }
    if (map.has(name)) reasons.push(`duplicate_header_${name}`);
    else map.set(name, value);
  }
  return { map, reasons };
}

function validateGitHubWorkflowRequestContract(headerEntries, context = {}) {
  const expectedVersion = String(context.expected_api_version || '');
  const normalized = normalizeHeaderEntries(headerEntries);
  const reasons = [...normalized.reasons];
  const headers = normalized.map;

  if (!API_VERSION.test(expectedVersion)) reasons.push('invalid_expected_api_version');
  if (headers.get('accept') !== 'application/vnd.github+json') reasons.push('unexpected_accept_media_type');
  if (headers.get('x-github-api-version') !== expectedVersion) reasons.push('api_version_mismatch');

  const authorization = headers.get('authorization') || '';
  if (!/^Bearer\s+\S+$/i.test(authorization)) reasons.push('missing_or_invalid_bearer_authorization');

  const userAgent = headers.get('user-agent') || '';
  if (!userAgent || /[\r\n]/.test(userAgent)) reasons.push('missing_or_invalid_user_agent');

  return {
    schema_version: 1,
    classification: reasons.length ? 'rejected' : 'validated_github_workflow_request_contract',
    verified: reasons.length === 0,
    reasons: [...new Set(reasons)],
    expected_api_version: expectedVersion || null,
    observed_api_version: headers.get('x-github-api-version') || null,
    accept_media_type: headers.get('accept') || null,
    authorization_present: Boolean(authorization),
    authorization_scheme: authorization ? authorization.split(/\s+/, 1)[0] : null,
    user_agent_present: Boolean(userAgent),
    credential_values_retained: false,
    trust_boundary: reasons.length ? 'untrusted' : 'github_rest_versioned_json_authenticated_request'
  };
}

module.exports = { validateGitHubWorkflowRequestContract };
