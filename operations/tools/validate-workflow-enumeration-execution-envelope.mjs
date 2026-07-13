import { createHash } from 'node:crypto';

const SHA_RE = /^[0-9a-f]{40}$/;
const API_VERSION_RE = /^\d{4}-\d{2}-\d{2}$/;

function fail(reason, details = {}) {
  return { verified: false, reason, ...details };
}

function normalizeHeaderMap(headers) {
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) return null;
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [String(key).toLowerCase(), String(value)])
  );
}

export function validateWorkflowEnumerationExecutionEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    return fail('invalid_envelope');
  }

  const {
    schema_version,
    repository,
    commit_sha,
    endpoint,
    api_version,
    accept,
    authenticated,
    permissions,
    retrieved_at,
    pages,
    total_count,
    records_digest,
    response_headers
  } = envelope;

  if (schema_version !== 1) return fail('unsupported_schema_version');
  if (typeof repository !== 'string' || !repository.includes('/')) return fail('invalid_repository');
  if (!SHA_RE.test(commit_sha ?? '')) return fail('invalid_commit_sha');
  if (endpoint !== `/repos/${repository}/actions/runs?head_sha=${commit_sha}&per_page=100`) {
    return fail('endpoint_not_exact_commit_bound');
  }
  if (!API_VERSION_RE.test(api_version ?? '')) return fail('api_version_not_explicit');
  if (accept !== 'application/vnd.github+json') return fail('accept_header_not_pinned');
  if (authenticated !== true) return fail('authentication_unproven');
  if (!Array.isArray(permissions) || !permissions.includes('actions:read')) {
    return fail('actions_read_permission_unproven');
  }
  if (Number.isNaN(Date.parse(retrieved_at ?? ''))) return fail('invalid_retrieved_at');
  if (!Number.isInteger(pages) || pages < 1 || pages > 10) return fail('invalid_page_count');
  if (!Number.isInteger(total_count) || total_count < 0) return fail('invalid_total_count');
  if (total_count >= 1000) return fail('provider_ceiling_ambiguous', { total_count });
  if (!/^[0-9a-f]{64}$/.test(records_digest ?? '')) return fail('invalid_records_digest');

  const headers = normalizeHeaderMap(response_headers);
  if (!headers) return fail('response_headers_missing');
  if (headers['x-github-api-version-selected'] !== api_version) {
    return fail('api_version_response_unconfirmed');
  }
  if (headers.deprecation || headers.sunset) {
    return fail('api_version_deprecation_active', {
      deprecation: headers.deprecation ?? null,
      sunset: headers.sunset ?? null
    });
  }
  if (!headers['x-ratelimit-limit'] || !headers['x-ratelimit-remaining']) {
    return fail('rate_limit_headers_missing');
  }

  const canonical = JSON.stringify({
    repository,
    commit_sha,
    endpoint,
    api_version,
    accept,
    authenticated,
    permissions: [...permissions].sort(),
    retrieved_at,
    pages,
    total_count,
    records_digest,
    response_headers: Object.fromEntries(Object.entries(headers).sort())
  });

  return {
    verified: true,
    reason: 'execution_envelope_verified',
    execution_digest: createHash('sha256').update(canonical).digest('hex'),
    api_version,
    total_count,
    pages
  };
}

export default validateWorkflowEnumerationExecutionEnvelope;
