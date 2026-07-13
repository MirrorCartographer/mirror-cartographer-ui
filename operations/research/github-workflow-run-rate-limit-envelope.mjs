const INTEGER_RE = /^\d+$/;

function fail(code, detail, page = null) {
  return { ok: false, code, detail, page };
}

function headerMap(headers) {
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) return null;
  return Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), String(value).trim()]));
}

export function assessWorkflowRunRateLimitEnvelope(input, options = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return fail('invalid_input', 'input must be an object');
  const pages = input.pages;
  if (!Array.isArray(pages) || pages.length === 0) return fail('missing_pages', 'at least one retained response page is required');

  const nowEpochSeconds = Number.isInteger(options.nowEpochSeconds)
    ? options.nowEpochSeconds
    : Math.floor(Date.now() / 1000);

  const ordered = [...pages].sort((a, b) => a.page - b.page);
  const terminalPages = ordered.filter((entry) => entry.terminal === true);
  if (terminalPages.length !== 1 || terminalPages[0] !== ordered.at(-1)) {
    return fail('terminal_page_unproven', 'exactly one terminal page must be retained and it must be the final page');
  }

  const observations = [];
  for (let index = 0; index < ordered.length; index += 1) {
    const entry = ordered[index];
    const expectedPage = index + 1;
    if (!Number.isInteger(entry.page) || entry.page !== expectedPage) {
      return fail('page_gap', `expected retained page ${expectedPage}`, entry.page ?? null);
    }
    if (!Number.isInteger(entry.status) || entry.status < 200 || entry.status > 299) {
      const code = entry.status === 403 || entry.status === 429 ? 'rate_limited_response' : 'http_error';
      return fail(code, `page ${entry.page} returned HTTP ${entry.status}`, entry.page);
    }

    const headers = headerMap(entry.headers);
    if (!headers) return fail('missing_headers', 'retained response headers are required', entry.page);

    const required = ['x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-used', 'x-ratelimit-reset', 'x-ratelimit-resource'];
    const missing = required.filter((name) => !(name in headers));
    if (missing.length) return fail('missing_rate_limit_headers', `missing ${missing.join(', ')}`, entry.page);

    const numericNames = ['x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-used', 'x-ratelimit-reset'];
    const invalidNumeric = numericNames.filter((name) => !INTEGER_RE.test(headers[name]));
    if (invalidNumeric.length) return fail('invalid_rate_limit_headers', `invalid ${invalidNumeric.join(', ')}`, entry.page);

    const limit = Number(headers['x-ratelimit-limit']);
    const remaining = Number(headers['x-ratelimit-remaining']);
    const used = Number(headers['x-ratelimit-used']);
    const reset = Number(headers['x-ratelimit-reset']);
    if (limit <= 0 || remaining < 0 || used < 0 || remaining > limit || used > limit) {
      return fail('incoherent_rate_limit_headers', 'rate-limit counters are outside valid bounds', entry.page);
    }
    if (headers['retry-after']) {
      return fail('retry_after_present', 'successful evidence collection must not retain a retry-after response', entry.page);
    }
    if (remaining === 0 && entry.terminal !== true) {
      return fail('pagination_budget_exhausted', 'rate-limit budget reached zero before the terminal page', entry.page);
    }
    if (reset <= nowEpochSeconds && remaining === 0 && entry.terminal !== true) {
      return fail('expired_exhausted_window', 'an exhausted non-terminal response has an elapsed reset time', entry.page);
    }

    observations.push({
      page: entry.page,
      resource: headers['x-ratelimit-resource'],
      limit,
      remaining,
      used,
      reset,
      terminal: entry.terminal === true,
    });
  }

  const resources = [...new Set(observations.map((entry) => entry.resource))];
  if (resources.length !== 1) return fail('rate_limit_resource_drift', `multiple resources observed: ${resources.join(', ')}`);

  return {
    ok: true,
    classification: 'rate_limit_proven_nonblocking_for_retained_pages',
    page_count: observations.length,
    resource: resources[0],
    minimum_remaining: Math.min(...observations.map((entry) => entry.remaining)),
    observations,
    evidence_strength: 'retained_response_header_contract',
    claim_boundary: [
      'Proves only that retained successful pages were not interrupted by an observed primary or secondary rate-limit response.',
      'Does not prove authentication scope, Link-header completeness, provider-ceiling absence, workflow existence, deployment identity, or runtime behavior.',
      'Secondary rate-limit status cannot be queried prospectively; this gate relies on retained response status, retry-after, and rate-limit headers.'
    ]
  };
}
