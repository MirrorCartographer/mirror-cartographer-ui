import { infrastructureConfig, assertProductionConfig } from './config.js';
import { authenticateRequest, issueDevelopmentSession, requestMagicLink } from './auth.js';
import { allowedCollections, createRepository } from './repository.js';

function corsHeaders(request, config) {
  const origin = request.headers.get('origin');
  if (!origin) return {};
  let allowed;
  try { allowed = new URL(config.appOrigin).origin; } catch { allowed = ''; }
  if (!allowed || origin !== allowed) {
    const error = new Error('Origin is not allowed.');
    error.statusCode = 403;
    throw error;
  }
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info',
    'access-control-max-age': '86400',
    vary: 'Origin',
  };
}

function jsonResponse(status, payload, cors = {}, extra = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...cors,
      ...extra,
    },
  });
}

async function readBody(request, maxBytes) {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > maxBytes) {
    const error = new Error('Request body is too large.');
    error.statusCode = 413;
    throw error;
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) {
    const error = new Error('Request body is too large.');
    error.statusCode = 413;
    throw error;
  }
  try { return text ? JSON.parse(text) : {}; }
  catch {
    const error = new Error('Request body must be valid JSON.');
    error.statusCode = 400;
    throw error;
  }
}

function requireMethod(request, expected) {
  if (request.method !== expected) {
    const error = new Error(`Method ${request.method} not allowed.`);
    error.statusCode = 405;
    throw error;
  }
}

function validateEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
    const error = new Error('A valid email address is required.');
    error.statusCode = 400;
    throw error;
  }
  return email;
}

export async function handleInfrastructureRequest(request, env = {}) {
  const config = infrastructureConfig(env);
  let cors = {};
  try {
    cors = corsHeaders(request, config);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    assertProductionConfig(config);
    const repository = createRepository(config);
    const url = new URL(request.url);
    const action = String(url.searchParams.get('action') || 'health');

    if (action === 'health') {
      requireMethod(request, 'GET');
      return jsonResponse(200, {
        ok: true,
        service: 'mirror-cartographer-infrastructure',
        persistence: repository.mode,
        auth: config.supabase.anonKey ? 'supabase' : 'development-only',
        collections: allowedCollections,
        time: new Date().toISOString(),
      }, cors);
    }

    if (action === 'auth.magic-link') {
      requireMethod(request, 'POST');
      const input = await readBody(request, config.limits.jsonBytes);
      return jsonResponse(202, await requestMagicLink(validateEmail(input.email), config), cors);
    }

    if (action === 'auth.development') {
      requireMethod(request, 'POST');
      if (config.production) return jsonResponse(404, { error: 'Not found.' }, cors);
      const input = await readBody(request, config.limits.jsonBytes);
      const token = await issueDevelopmentSession({ email: validateEmail(input.email || 'local@mirrorcartographer.test') }, config);
      return jsonResponse(200, { token, provider: 'development' }, cors);
    }

    if (action === 'config.public') {
      requireMethod(request, 'GET');
      return jsonResponse(200, {
        payments: config.payments,
        uploadLimit: config.limits.uploadBytes,
        persistence: repository.mode,
      }, cors);
    }

    const identity = await authenticateRequest(request, config);

    if (action === 'records.list') {
      requireMethod(request, 'GET');
      const collection = String(url.searchParams.get('collection') || '');
      const search = String(url.searchParams.get('search') || '');
      return jsonResponse(200, { records: await repository.list(identity.sub, collection, { search }) }, cors);
    }

    if (action === 'records.upsert') {
      requireMethod(request, 'POST');
      const input = await readBody(request, config.limits.jsonBytes);
      const record = await repository.upsert(identity.sub, String(input.collection || ''), input.record || {});
      return jsonResponse(200, { record }, cors);
    }

    if (action === 'records.delete') {
      requireMethod(request, 'POST');
      const input = await readBody(request, config.limits.jsonBytes);
      return jsonResponse(200, await repository.remove(identity.sub, String(input.collection || ''), String(input.id || '')), cors);
    }

    if (action === 'records.export') {
      requireMethod(request, 'GET');
      const records = await repository.exportAll(identity.sub);
      return jsonResponse(200, {
        schema: 'mirror-cartographer-continuity-export/v1',
        exportedAt: new Date().toISOString(),
        owner: identity.sub,
        records,
      }, cors, { 'content-disposition': 'attachment; filename="mirror-cartographer-export.json"' });
    }

    if (action === 'uploads.prepare') {
      requireMethod(request, 'POST');
      const input = await readBody(request, config.limits.jsonBytes);
      const size = Number(input.size || 0);
      if (!input.name || size < 0 || size > config.limits.uploadBytes) {
        const error = new Error('Invalid file metadata or file exceeds upload limit.');
        error.statusCode = 400;
        throw error;
      }
      return jsonResponse(200, await repository.createSignedUpload(identity.sub, input), cors);
    }

    return jsonResponse(404, { error: `Unknown action: ${action}` }, cors);
  } catch (error) {
    console.error('[mirror-cartographer-api]', error);
    return jsonResponse(error.statusCode || 500, {
      error: error.statusCode ? error.message : 'Infrastructure request failed.',
      code: error.code || null,
    }, cors);
  }
}
