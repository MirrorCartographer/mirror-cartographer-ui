import crypto from 'node:crypto';

const MEMORY = new Map();
const TABLES = new Set([
  'archive_entries', 'symbols', 'body_markers', 'health_events', 'animals',
  'vet_records', 'research_claims', 'evidence_nodes', 'concept_nodes',
  'decisions', 'projects', 'artifacts', 'offers', 'money_events',
  'proof_scenes', 'arc_experiments', 'settings',
]);

function ensureTable(table) {
  if (!TABLES.has(table)) {
    const error = new Error(`Unknown continuity collection: ${table}`);
    error.statusCode = 400;
    throw error;
  }
}

function normalizeRecord(table, ownerId, input = {}) {
  const now = new Date().toISOString();
  return {
    id: input.id || crypto.randomUUID(),
    owner_id: ownerId,
    collection: table,
    title: String(input.title || '').slice(0, 240),
    content: input.content ?? input.data ?? {},
    privacy: ['private', 'shared', 'public-safe'].includes(input.privacy) ? input.privacy : 'private',
    source: input.source || 'website',
    tags: Array.isArray(input.tags) ? input.tags.slice(0, 50).map(String) : [],
    created_at: input.created_at || now,
    updated_at: now,
  };
}

function supabaseHeaders(config, extra = {}) {
  return {
    apikey: config.supabase.serviceRoleKey,
    authorization: `Bearer ${config.supabase.serviceRoleKey}`,
    'content-type': 'application/json',
    ...extra,
  };
}

async function supabaseRequest(config, path, options = {}) {
  const response = await fetch(`${config.supabase.url}${path}`, {
    ...options,
    headers: supabaseHeaders(config, options.headers),
  });
  if (!response.ok) {
    const detail = await response.text();
    const error = new Error(`Persistence request failed (${response.status}): ${detail.slice(0, 300)}`);
    error.statusCode = 502;
    throw error;
  }
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function absoluteStorageUrl(config, value) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `${config.supabase.url}${value.startsWith('/') ? '' : '/'}${value}`;
}

export function createRepository(config) {
  const remote = config.supabase.enabled;

  return {
    mode: remote ? 'supabase' : 'memory',

    async list(ownerId, table, { search = '', limit = config.limits.listPageSize } = {}) {
      ensureTable(table);
      if (!remote) {
        const records = [...(MEMORY.get(ownerId) || [])].filter((record) => record.collection === table);
        const query = search.toLowerCase();
        return records
          .filter((record) => !query || `${record.title} ${JSON.stringify(record.content)} ${record.tags.join(' ')}`.toLowerCase().includes(query))
          .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
          .slice(0, Math.min(limit, 250));
      }
      const params = new URLSearchParams({
        owner_id: `eq.${ownerId}`,
        collection: `eq.${table}`,
        order: 'updated_at.desc',
        limit: String(Math.min(limit, 250)),
      });
      if (search) params.set('search_text', `ilike.*${search.replace(/[,*()]/g, '')}*`);
      return supabaseRequest(config, `/rest/v1/continuity_records?${params}`, { method: 'GET' });
    },

    async upsert(ownerId, table, input) {
      ensureTable(table);
      const record = normalizeRecord(table, ownerId, input);
      if (!remote) {
        const records = MEMORY.get(ownerId) || [];
        const index = records.findIndex((item) => item.id === record.id);
        if (index >= 0) records[index] = { ...records[index], ...record };
        else records.push(record);
        MEMORY.set(ownerId, records);
        return record;
      }
      const result = await supabaseRequest(config, '/rest/v1/continuity_records?on_conflict=id,owner_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(record),
      });
      return result?.[0] || record;
    },

    async remove(ownerId, table, id) {
      ensureTable(table);
      if (!remote) {
        const records = MEMORY.get(ownerId) || [];
        MEMORY.set(ownerId, records.filter((item) => !(item.id === id && item.collection === table)));
        return { deleted: true };
      }
      await supabaseRequest(config, `/rest/v1/continuity_records?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(ownerId)}&collection=eq.${table}`, {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' },
      });
      return { deleted: true };
    },

    async exportAll(ownerId) {
      if (!remote) return [...(MEMORY.get(ownerId) || [])];
      return supabaseRequest(config, `/rest/v1/continuity_records?owner_id=eq.${encodeURIComponent(ownerId)}&order=created_at.asc`, { method: 'GET' });
    },

    async createSignedUpload(ownerId, file) {
      if (!remote) {
        return { mode: 'metadata-only', path: `${ownerId}/${crypto.randomUUID()}-${file.name}`, uploadUrl: null };
      }
      const safeName = String(file.name || 'file').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-160);
      const path = `${ownerId}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${safeName}`;
      const response = await fetch(`${config.supabase.url}/storage/v1/object/upload/sign/${config.supabase.bucket}/${path}`, {
        method: 'POST',
        headers: supabaseHeaders(config),
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error(`Could not create upload URL (${response.status}).`);
      const signed = await response.json();
      const rawUrl = signed.url || signed.signedURL;
      return { mode: 'signed-upload', path, token: signed.token, uploadUrl: absoluteStorageUrl(config, rawUrl) };
    },
  };
}

export const allowedCollections = [...TABLES];
