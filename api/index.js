import { infrastructureConfig, assertProductionConfig } from '../server/config.js';
import { authenticateRequest, issueDevelopmentSession, requestMagicLink } from '../server/auth.js';
import { allowedCollections, createRepository } from '../server/repository.js';

function send(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
  res.end(JSON.stringify(body));
}

async function body(req, maxBytes) {
  if (req.body && typeof req.body === 'object') return req.body;
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error('Request body is too large.');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

function method(req, expected) {
  if (req.method !== expected) {
    const error = new Error(`Method ${req.method} not allowed.`);
    error.statusCode = 405;
    throw error;
  }
}

function validateEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const error = new Error('A valid email address is required.');
    error.statusCode = 400;
    throw error;
  }
  return email;
}

export default async function handler(req, res) {
  const config = infrastructureConfig();
  try {
    assertProductionConfig(config);
    const repository = createRepository(config);
    const action = String(req.query?.action || 'health');

    if (action === 'health') {
      method(req, 'GET');
      return send(res, 200, {
        ok: true,
        service: 'mirror-cartographer-infrastructure',
        persistence: repository.mode,
        auth: config.supabase.anonKey ? 'supabase' : 'development-only',
        collections: allowedCollections,
        time: new Date().toISOString(),
      });
    }

    if (action === 'auth.magic-link') {
      method(req, 'POST');
      const input = await body(req, config.limits.jsonBytes);
      return send(res, 202, await requestMagicLink(validateEmail(input.email), config));
    }

    if (action === 'auth.development') {
      method(req, 'POST');
      if (config.production) return send(res, 404, { error: 'Not found.' });
      const input = await body(req, config.limits.jsonBytes);
      const token = issueDevelopmentSession({ email: validateEmail(input.email || 'local@mirrorcartographer.test') }, config);
      return send(res, 200, { token, provider: 'development' });
    }

    if (action === 'config.public') {
      method(req, 'GET');
      return send(res, 200, {
        payments: config.payments,
        uploadLimit: config.limits.uploadBytes,
        persistence: repository.mode,
      });
    }

    const identity = await authenticateRequest(req, config);

    if (action === 'records.list') {
      method(req, 'GET');
      const collection = String(req.query?.collection || '');
      const search = String(req.query?.search || '');
      return send(res, 200, { records: await repository.list(identity.sub, collection, { search }) });
    }

    if (action === 'records.upsert') {
      method(req, 'POST');
      const input = await body(req, config.limits.jsonBytes);
      const record = await repository.upsert(identity.sub, String(input.collection || ''), input.record || {});
      return send(res, 200, { record });
    }

    if (action === 'records.delete') {
      method(req, 'POST');
      const input = await body(req, config.limits.jsonBytes);
      return send(res, 200, await repository.remove(identity.sub, String(input.collection || ''), String(input.id || '')));
    }

    if (action === 'records.export') {
      method(req, 'GET');
      const records = await repository.exportAll(identity.sub);
      return send(res, 200, {
        schema: 'mirror-cartographer-continuity-export/v1',
        exportedAt: new Date().toISOString(),
        owner: identity.sub,
        records,
      }, { 'content-disposition': 'attachment; filename="mirror-cartographer-export.json"' });
    }

    if (action === 'uploads.prepare') {
      method(req, 'POST');
      const input = await body(req, config.limits.jsonBytes);
      const size = Number(input.size || 0);
      if (!input.name || size < 0 || size > config.limits.uploadBytes) {
        const error = new Error('Invalid file metadata or file exceeds upload limit.');
        error.statusCode = 400;
        throw error;
      }
      return send(res, 200, await repository.createSignedUpload(identity.sub, input));
    }

    return send(res, 404, { error: `Unknown action: ${action}` });
  } catch (error) {
    console.error('[mirror-cartographer-api]', error);
    return send(res, error.statusCode || 500, {
      error: error.statusCode ? error.message : 'Infrastructure request failed.',
      code: error.code || null,
    });
  }
}
