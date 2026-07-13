import { createHash } from 'node:crypto';

const SHA_RE = /^[0-9a-f]{40}$/;
const DIGEST_RE = /^[0-9a-f]{64}$/;

function fail(reason, details = {}) {
  return { verified: false, reason, ...details };
}

function headersOf(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [String(k).toLowerCase(), String(v)]));
}

function nextUrl(link = '') {
  const match = String(link).match(/<([^>]+)>;\s*rel="next"/i);
  return match?.[1] ?? null;
}

function expectedUrl(repository, commitSha, page) {
  const base = `https://api.github.com/repos/${repository}/actions/runs?head_sha=${commitSha}&per_page=100`;
  return page === 1 ? base : `${base}&page=${page}`;
}

export function validateWorkflowPageChain(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return fail('invalid_manifest');
  const { schema_version, repository, commit_sha, api_version, pages } = manifest;
  if (schema_version !== 1) return fail('unsupported_schema_version');
  if (typeof repository !== 'string' || !repository.includes('/')) return fail('invalid_repository');
  if (!SHA_RE.test(commit_sha ?? '')) return fail('invalid_commit_sha');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(api_version ?? '')) return fail('invalid_api_version');
  if (!Array.isArray(pages) || pages.length < 1 || pages.length > 10) return fail('invalid_pages');

  const requestIds = new Set();
  const recordIds = new Set();
  let totalRecords = 0;

  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    const number = index + 1;
    if (!page || typeof page !== 'object' || Array.isArray(page)) return fail('invalid_page', { page: number });
    if (page.page !== number) return fail('non_contiguous_page_number', { page: number, observed: page.page });
    if (page.request_url !== expectedUrl(repository, commit_sha, number)) {
      return fail('request_url_mismatch', { page: number, observed: page.request_url });
    }
    if (page.status !== 200) return fail('non_success_status', { page: number, status: page.status });
    if (Number.isNaN(Date.parse(page.retrieved_at ?? ''))) return fail('invalid_retrieved_at', { page: number });
    if (!DIGEST_RE.test(page.body_sha256 ?? '')) return fail('invalid_body_digest', { page: number });
    if (!Array.isArray(page.record_ids)) return fail('record_ids_missing', { page: number });

    const headers = headersOf(page.response_headers);
    if (!headers) return fail('response_headers_missing', { page: number });
    if (headers['x-github-api-version-selected'] !== api_version) {
      return fail('api_version_response_unconfirmed', { page: number });
    }
    const requestId = headers['x-github-request-id'];
    if (!requestId) return fail('request_id_missing', { page: number });
    if (requestIds.has(requestId)) return fail('duplicate_request_id', { page: number, request_id: requestId });
    requestIds.add(requestId);

    for (const id of page.record_ids) {
      if (!Number.isInteger(id) || id < 1) return fail('invalid_record_id', { page: number, id });
      if (recordIds.has(id)) return fail('duplicate_record_id', { page: number, id });
      recordIds.add(id);
    }
    totalRecords += page.record_ids.length;

    const observedNext = nextUrl(headers.link);
    const expectedNext = number < pages.length ? expectedUrl(repository, commit_sha, number + 1) : null;
    if (observedNext !== expectedNext) {
      return fail('link_chain_mismatch', { page: number, expected_next: expectedNext, observed_next: observedNext });
    }
  }

  const canonical = JSON.stringify({
    repository,
    commit_sha,
    api_version,
    pages: pages.map((page) => ({
      page: page.page,
      request_url: page.request_url,
      status: page.status,
      retrieved_at: page.retrieved_at,
      body_sha256: page.body_sha256,
      record_ids: page.record_ids,
      response_headers: Object.fromEntries(Object.entries(headersOf(page.response_headers)).sort())
    }))
  });

  return {
    verified: true,
    reason: 'workflow_page_chain_verified',
    page_count: pages.length,
    record_count: totalRecords,
    page_chain_digest: createHash('sha256').update(canonical).digest('hex')
  };
}

export default validateWorkflowPageChain;
