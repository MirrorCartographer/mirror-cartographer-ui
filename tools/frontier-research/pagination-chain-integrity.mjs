const HTTPS_GITHUB_API = /^https:\/\/api\.github\.com\//;
const SENSITIVE_QUERY_KEYS = new Set(['access_token', 'token', 'client_secret', 'code']);

function fail(reason, details = {}) {
  return { verified: false, reason, ...details };
}

function normalizeUrl(value) {
  if (typeof value !== 'string' || !HTTPS_GITHUB_API.test(value)) return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  for (const key of url.searchParams.keys()) {
    if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) return null;
  }
  url.hash = '';
  return url.toString();
}

export function validatePaginationChainIntegrity(receipt) {
  if (!receipt || typeof receipt !== 'object') return fail('receipt_invalid');
  if (!Array.isArray(receipt.pages) || receipt.pages.length === 0) return fail('pages_missing');
  if (receipt.page_count !== receipt.pages.length) return fail('page_count_mismatch');

  const seenRequestUrls = new Set();
  for (let index = 0; index < receipt.pages.length; index += 1) {
    const page = receipt.pages[index];
    const expectedNumber = index + 1;
    if (page.page_number !== expectedNumber) return fail('page_sequence_invalid', { page: expectedNumber });

    const requestUrl = normalizeUrl(page.request_url);
    if (!requestUrl) return fail('request_url_invalid', { page: expectedNumber });
    if (seenRequestUrls.has(requestUrl)) return fail('request_url_replayed', { page: expectedNumber });
    seenRequestUrls.add(requestUrl);

    const isLast = index === receipt.pages.length - 1;
    if (isLast) {
      if (page.next_url !== null) return fail('terminal_page_has_next_url', { page: expectedNumber });
      continue;
    }

    const nextUrl = normalizeUrl(page.next_url);
    if (!nextUrl) return fail('next_url_invalid', { page: expectedNumber });
    const followingRequestUrl = normalizeUrl(receipt.pages[index + 1]?.request_url);
    if (!followingRequestUrl || nextUrl !== followingRequestUrl) {
      return fail('pagination_chain_discontinuity', { page: expectedNumber, next_page: expectedNumber + 1 });
    }
  }

  return {
    verified: true,
    reason: 'pagination_chain_integrity_valid',
    page_count: receipt.pages.length,
    claim_boundary: {
      proves_link_traversal_continuity: true,
      proves_response_body_authenticity: false,
      proves_semantic_completeness: false,
      proves_provider_absence: false
    }
  };
}
