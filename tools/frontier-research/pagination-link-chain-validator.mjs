function normalizeUrl(raw, label) {
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new TypeError(`${label}_url_required`);
  }
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new TypeError(`${label}_url_invalid`);
  }
  if (url.protocol !== 'https:') {
    throw new TypeError(`${label}_url_must_be_https`);
  }
  url.hash = '';
  return url.toString();
}

function parseLinkHeader(raw, label) {
  if (raw == null || raw === '') return {};
  if (typeof raw !== 'string') throw new TypeError(`${label}_link_header_invalid`);

  const relations = {};
  for (const segment of raw.split(',')) {
    const match = segment.trim().match(/^<([^>]+)>\s*;\s*rel="([^"]+)"$/i);
    if (!match) throw new TypeError(`${label}_link_header_malformed`);
    const [, target, relList] = match;
    for (const rel of relList.trim().split(/\s+/)) {
      if (relations[rel]) throw new TypeError(`${label}_duplicate_${rel}_relation`);
      relations[rel] = normalizeUrl(target, `${label}_${rel}`);
    }
  }
  return relations;
}

export function buildPaginationLinkChainProof({ client, pages }) {
  if (typeof client !== 'string' || client.length === 0) {
    throw new TypeError('client_required');
  }
  if (!Array.isArray(pages) || pages.length === 0) {
    throw new TypeError(`${client}_pages_required`);
  }

  const seen = new Set();
  const normalized = pages.map((page, index) => {
    if (!page || typeof page !== 'object' || Array.isArray(page)) {
      throw new TypeError(`${client}_page_${index + 1}_invalid`);
    }
    if (page.page_index !== index + 1) {
      throw new TypeError(`${client}_page_sequence_invalid`);
    }

    const requestUrl = normalizeUrl(page.request_url, `${client}_page_${index + 1}_request`);
    if (seen.has(requestUrl)) throw new TypeError(`${client}_request_url_repeated`);
    seen.add(requestUrl);

    const relations = parseLinkHeader(page.headers?.link, `${client}_page_${index + 1}`);
    return {
      page_index: page.page_index,
      request_url: requestUrl,
      relations
    };
  });

  for (let index = 0; index < normalized.length; index += 1) {
    const current = normalized[index];
    const next = normalized[index + 1];

    if (next) {
      if (!current.relations.next) {
        throw new TypeError(`${client}_page_${current.page_index}_next_relation_missing`);
      }
      if (current.relations.next !== next.request_url) {
        throw new TypeError(`${client}_page_${current.page_index}_next_target_mismatch`);
      }
    } else if (current.relations.next) {
      throw new TypeError(`${client}_terminal_page_still_has_next_relation`);
    }
  }

  return {
    schema_version: 1,
    evidence_class: 'retained_pagination_link_chain_proof',
    client,
    ok: true,
    page_count: normalized.length,
    initial_request_url: normalized[0].request_url,
    terminal_request_url: normalized.at(-1).request_url,
    pages: normalized,
    source_status: {
      pagination_semantics: 'observed_primary_source',
      retained_page_records: 'runtime_evidence_required'
    },
    uncertainty: [
      'This proves internal continuity of retained request URLs and Link headers, not that the retained records are authentic or complete by themselves.',
      'Endpoint-specific provider ceilings and secondary rate limits remain separate fail-closed conditions.'
    ],
    falsification_route: [
      'Reject any skipped, duplicated, malformed, non-HTTPS, or repeated request URL.',
      'Reject every non-terminal page whose rel="next" target does not exactly equal the following retained request URL.',
      'Reject a terminal page that still advertises rel="next".'
    ]
  };
}
