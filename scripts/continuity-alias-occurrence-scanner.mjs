import { createHash } from 'node:crypto';

const CLAIM_STATES = new Set(['observed', 'inferred', 'proposed', 'superseded', 'unresolved']);
const PRIVATE_KEYS = new Set(['raw_text', 'quote', 'excerpt', 'content', 'body', 'message']);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

export function scanAliasOccurrences(registry, occurrences) {
  if (!registry || !Array.isArray(registry.aliases)) throw new Error('registry.aliases must be an array');
  if (!Array.isArray(occurrences)) throw new Error('occurrences must be an array');

  const aliases = new Map(registry.aliases.map((alias) => [alias.raw_value, alias]));
  const rows = occurrences.map((occurrence, index) => {
    for (const key of PRIVATE_KEYS) {
      if (key in occurrence) throw new Error(`occurrence ${index} contains forbidden private field: ${key}`);
    }
    for (const key of ['raw_value', 'source_id', 'source_kind', 'observed_at', 'claim_state']) {
      if (!occurrence[key]) throw new Error(`occurrence ${index} missing ${key}`);
    }
    if (!CLAIM_STATES.has(occurrence.claim_state)) throw new Error(`occurrence ${index} has invalid claim_state`);
    if (occurrence.source_kind === 'private' && !occurrence.source_hash) {
      throw new Error(`occurrence ${index} private source requires source_hash`);
    }

    const alias = aliases.get(occurrence.raw_value);
    return {
      raw_value: occurrence.raw_value,
      normalized_value: alias?.normalized_value ?? occurrence.raw_value,
      entity_type: alias?.type ?? 'unresolved_alias',
      lifecycle_status: occurrence.lifecycle_status ?? alias?.status ?? 'unresolved',
      confidence: occurrence.confidence ?? alias?.confidence ?? 'low',
      claim_state: occurrence.claim_state,
      source: {
        id: occurrence.source_id,
        kind: occurrence.source_kind,
        hash: occurrence.source_hash ?? null
      },
      observed_at: occurrence.observed_at,
      conflict: false
    };
  });

  const statuses = new Map();
  for (const row of rows) {
    if (!statuses.has(row.normalized_value)) statuses.set(row.normalized_value, new Set());
    statuses.get(row.normalized_value).add(row.lifecycle_status);
  }
  for (const row of rows) row.conflict = statuses.get(row.normalized_value).size > 1;

  rows.sort((a, b) => JSON.stringify(stable(a)).localeCompare(JSON.stringify(stable(b))));
  const canonical = stable({ schema_version: 1, rows });
  return {
    ...canonical,
    digest_sha256: createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
  };
}
