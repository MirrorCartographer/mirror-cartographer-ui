'use strict';

const SENSITIVE_HEADER_NAMES = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'proxy-authorization',
  'x-github-token',
  'x-oauth-token'
]);

function normalizeHeaderEntries(headers) {
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) return [];
  return Object.entries(headers).map(([key, value]) => [
    String(key).toLowerCase(),
    Array.isArray(value) ? value.join(', ') : String(value)
  ]);
}

function pick(headers, name) {
  const hit = normalizeHeaderEntries(headers).find(([key]) => key === name);
  return hit ? hit[1] : null;
}

function buildSanitizedGithubResponseEvidence(input) {
  const reasons = [];
  const requestHeaders = input?.request?.headers;
  const responseHeaders = input?.response?.headers;
  const status = Number(input?.response?.status);
  const requestedVersion = input?.request?.api_version || null;
  const transmittedVersion = pick(requestHeaders, 'x-github-api-version');

  const sensitiveObserved = normalizeHeaderEntries(requestHeaders)
    .filter(([key]) => SENSITIVE_HEADER_NAMES.has(key))
    .map(([key]) => key)
    .sort();

  if (!requestedVersion) reasons.push('missing_requested_api_version');
  if (!transmittedVersion) reasons.push('missing_transmitted_api_version');
  if (!Number.isInteger(status) || status < 100 || status > 599) reasons.push('invalid_response_status');

  return {
    schema_version: 1,
    classification: reasons.length ? 'rejected' : 'sanitized_github_response_evidence',
    verified: reasons.length === 0,
    reasons,
    request: {
      api_version: requestedVersion,
      headers: {
        'X-GitHub-Api-Version': transmittedVersion,
        Accept: pick(requestHeaders, 'accept'),
        'User-Agent': pick(requestHeaders, 'user-agent')
      },
      sensitive_headers_observed: sensitiveObserved,
      sensitive_header_values_retained: false
    },
    response: {
      status: Number.isInteger(status) ? status : null,
      headers: {
        Deprecation: pick(responseHeaders, 'deprecation'),
        Sunset: pick(responseHeaders, 'sunset'),
        Link: pick(responseHeaders, 'link'),
        'X-GitHub-Request-Id': pick(responseHeaders, 'x-github-request-id')
      }
    }
  };
}

module.exports = { buildSanitizedGithubResponseEvidence };
