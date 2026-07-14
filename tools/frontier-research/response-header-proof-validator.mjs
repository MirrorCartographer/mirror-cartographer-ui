function integerHeader(headers, name, { minimum = 0 } = {}) {
  const raw = headers?.[name];
  const value = typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : raw;
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new TypeError(`${name.replaceAll('-', '_')}_invalid`);
  }
  return value;
}

function validateClientPages(client, pages) {
  if (!Array.isArray(pages) || pages.length === 0) {
    throw new TypeError(`${client}_response_pages_required`);
  }

  let resource = null;
  let minimumRemaining = Number.POSITIVE_INFINITY;
  let previousReset = null;

  const normalized = pages.map((page, offset) => {
    if (!page || typeof page !== 'object' || Array.isArray(page)) {
      throw new TypeError(`${client}_page_${offset + 1}_invalid`);
    }
    if (page.page_index !== offset + 1) {
      throw new TypeError(`${client}_page_sequence_invalid`);
    }
    if (!Number.isInteger(page.status) || page.status < 200 || page.status >= 300) {
      throw new TypeError(`${client}_page_${offset + 1}_status_not_successful`);
    }

    const headers = page.headers;
    const limit = integerHeader(headers, 'x-ratelimit-limit', { minimum: 1 });
    const remaining = integerHeader(headers, 'x-ratelimit-remaining');
    const used = integerHeader(headers, 'x-ratelimit-used');
    const reset = integerHeader(headers, 'x-ratelimit-reset', { minimum: 1 });
    const currentResource = headers?.['x-ratelimit-resource'];

    if (typeof currentResource !== 'string' || currentResource.length === 0) {
      throw new TypeError(`${client}_page_${offset + 1}_resource_invalid`);
    }
    if (remaining > limit || used > limit) {
      throw new TypeError(`${client}_page_${offset + 1}_rate_limit_arithmetic_invalid`);
    }
    if (resource !== null && currentResource !== resource) {
      throw new TypeError(`${client}_rate_limit_resource_changed`);
    }
    if (previousReset !== null && reset < previousReset) {
      throw new TypeError(`${client}_rate_limit_reset_regressed`);
    }

    resource = currentResource;
    minimumRemaining = Math.min(minimumRemaining, remaining);
    previousReset = reset;

    return {
      page_index: page.page_index,
      status: page.status,
      limit,
      remaining,
      used,
      reset,
      resource: currentResource
    };
  });

  return {
    page_count: normalized.length,
    minimum_remaining: minimumRemaining,
    resource,
    classification: minimumRemaining === 0 ? `${client}_limit_exhausted` : `${client}_limit_observed_available`,
    pages: normalized
  };
}

export function buildDualClientResponseHeaderProof({ primaryPages, independentPages }) {
  const primary = validateClientPages('primary', primaryPages);
  const independent = validateClientPages('independent', independentPages);

  if (primary.resource !== independent.resource) {
    throw new TypeError('dual_client_rate_limit_resource_mismatch');
  }

  const promotionPermitted = primary.minimum_remaining > 0 && independent.minimum_remaining > 0;

  return {
    schema_version: 1,
    evidence_class: 'dual_client_retained_response_header_contract',
    ok: promotionPermitted,
    promotion_permitted: promotionPermitted,
    resource: primary.resource,
    clients: { primary, independent },
    falsification_route: [
      'Reject any missing, malformed, unsuccessful, duplicated, skipped, or out-of-order page record.',
      'Reject arithmetic-invalid headers, regressing reset epochs, or resource changes within either client.',
      'Reject disagreement between client resource classes or exhaustion observed by either client.'
    ]
  };
}
