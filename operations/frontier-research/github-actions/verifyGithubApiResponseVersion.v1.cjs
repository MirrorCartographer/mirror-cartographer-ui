'use strict';

function normalizeHeaders(headers) {
  const out = {};
  if (!headers || typeof headers !== 'object') return out;
  for (const [key, value] of Object.entries(headers)) {
    out[String(key).toLowerCase()] = Array.isArray(value) ? value.join(', ') : String(value);
  }
  return out;
}

function verifyGithubApiResponseVersion(input) {
  const reasons = [];
  const requestedVersion = input?.request?.api_version || null;
  const requestHeader = input?.request?.headers?.['X-GitHub-Api-Version']
    || input?.request?.headers?.['x-github-api-version']
    || null;
  const status = Number(input?.response?.status);
  const headers = normalizeHeaders(input?.response?.headers);

  if (!requestedVersion) reasons.push('missing_requested_api_version');
  if (!requestHeader) reasons.push('missing_api_version_request_header');
  if (requestedVersion && requestHeader && requestedVersion !== requestHeader) {
    reasons.push('request_header_version_mismatch');
  }
  if (!Number.isInteger(status) || status < 100 || status > 599) {
    reasons.push('invalid_response_status');
  } else if (status === 410) {
    reasons.push('api_version_gone');
  } else if (status < 200 || status >= 300) {
    reasons.push('non_success_response_status');
  }
  if (headers.deprecation) reasons.push('api_version_deprecation_announced');
  if (headers.sunset) reasons.push('api_version_sunset_announced');

  return {
    schema_version: 1,
    classification: reasons.length ? 'rejected' : 'github_api_response_version_verified',
    verified: reasons.length === 0,
    reasons,
    requested_api_version: requestedVersion,
    request_header_api_version: requestHeader,
    response_status: Number.isInteger(status) ? status : null,
    deprecation: headers.deprecation || null,
    sunset: headers.sunset || null
  };
}

module.exports = { normalizeHeaders, verifyGithubApiResponseVersion };
