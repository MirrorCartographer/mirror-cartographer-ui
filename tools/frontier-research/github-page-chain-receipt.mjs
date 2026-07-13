import { createHash } from 'node:crypto';

const SHA256 = /^[a-f0-9]{64}$/;
const REQUEST_ID = /^[A-Za-z0-9:-]+$/;

function fail(reason) {
  return { verified: false, reason };
}

function canonicalUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'api.github.com') {
    throw new Error('page URL must use https://api.github.com');
  }
  url.hash = '';
  return url.toString();
}

function nextLink(linkHeader) {
  if (linkHeader == null || linkHeader === '') return null;
  const matches = [...linkHeader.matchAll(/<([^>]+)>;\s*rel="([^"]+)"/g)];
  const next = matches.find((match) => match[2].split(/\s+/).includes('next'));
  return next ? canonicalUrl(next[1]) : null;
}

export function sha256Utf8(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function verifyGitHubPageChain(receipt) {
  try {
    if (!receipt || receipt.schema_version !== 1) return fail('unsupported_schema');
    if (!/^[a-f0-9]{40}$/.test(receipt.commit_sha ?? '')) return fail('invalid_commit_sha');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(receipt.requested_api_version ?? '')) return fail('invalid_requested_api_version');
    if (!Array.isArray(receipt.pages) || receipt.pages.length === 0) return fail('missing_pages');

    let expectedUrl = canonicalUrl(receipt.initial_url);
    const requestIds = new Set();

    for (let index = 0; index < receipt.pages.length; index += 1) {
      const page = receipt.pages[index];
      if (page.index !== index + 1) return fail('nonsequential_page_index');
      if (canonicalUrl(page.url) !== expectedUrl) return fail('broken_link_chain');
      if (page.status !== 200) return fail('non_200_response');
      if (page.api_version_selected !== receipt.requested_api_version) return fail('api_version_mismatch');
      if (!REQUEST_ID.test(page.github_request_id ?? '')) return fail('missing_request_id');
      if (requestIds.has(page.github_request_id)) return fail('duplicate_request_id');
      requestIds.add(page.github_request_id);
      if (!SHA256.test(page.body_sha256 ?? '')) return fail('invalid_body_sha256');
      if (typeof page.body_utf8 !== 'string') return fail('missing_body');
      if (sha256Utf8(page.body_utf8) !== page.body_sha256) return fail('body_digest_mismatch');
      if (page.etag != null && typeof page.etag !== 'string') return fail('invalid_etag');

      const next = nextLink(page.link ?? null);
      const isLast = index === receipt.pages.length - 1;
      if (isLast && next !== null) return fail('truncated_pagination');
      if (!isLast && next === null) return fail('unexpected_chain_end');
      if (next !== null) expectedUrl = next;
    }

    return {
      verified: true,
      page_count: receipt.pages.length,
      request_id_count: requestIds.size,
      requested_api_version: receipt.requested_api_version,
      claim_boundary: 'transport_and_pagination_receipt_only'
    };
  } catch (error) {
    return fail(`invalid_receipt:${error.message}`);
  }
}
