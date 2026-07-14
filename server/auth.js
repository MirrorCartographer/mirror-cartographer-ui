import crypto from 'node:crypto';

const encoder = new TextEncoder();
const b64url = (input) => Buffer.from(input).toString('base64url');
const fromB64url = (input) => Buffer.from(input, 'base64url').toString('utf8');

function signature(data, secret) {
  return crypto.createHmac('sha256', secret).update(data).digest('base64url');
}

export function issueDevelopmentSession(identity, config, ttlSeconds = 60 * 60 * 24 * 7) {
  if (config.production) throw new Error('Development sessions are disabled in production.');
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(JSON.stringify({
    sub: identity.id || crypto.randomUUID(),
    email: identity.email || 'local@mirrorcartographer.test',
    role: 'authenticated',
    iat: now,
    exp: now + ttlSeconds,
    provider: 'development',
  }));
  return `${payload}.${signature(payload, config.sessionSecret)}`;
}

export function verifyDevelopmentSession(token, config) {
  const [payload, provided] = String(token || '').split('.');
  if (!payload || !provided) return null;
  const expected = signature(payload, config.sessionSecret);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) return null;
  const identity = JSON.parse(fromB64url(payload));
  if (!identity.exp || identity.exp < Math.floor(Date.now() / 1000)) return null;
  return identity;
}

async function verifySupabaseToken(token, config) {
  if (!config.supabase.url || !config.supabase.anonKey) return null;
  const response = await fetch(`${config.supabase.url}/auth/v1/user`, {
    headers: {
      apikey: config.supabase.anonKey,
      authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) return null;
  const user = await response.json();
  return {
    sub: user.id,
    email: user.email || null,
    role: user.role || 'authenticated',
    provider: user.app_metadata?.provider || 'supabase',
    raw: user,
  };
}

export async function authenticateRequest(req, config, { optional = false } = {}) {
  const authorization = String(req.headers.authorization || '');
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) {
    if (optional) return null;
    const error = new Error('Authentication required.');
    error.statusCode = 401;
    throw error;
  }

  const development = verifyDevelopmentSession(token, config);
  if (development) return development;
  const supabase = await verifySupabaseToken(token, config);
  if (supabase) return supabase;

  const error = new Error('Invalid or expired session.');
  error.statusCode = 401;
  throw error;
}

export async function requestMagicLink(email, config) {
  if (!config.supabase.url || !config.supabase.anonKey) {
    const error = new Error('Magic-link authentication is not configured.');
    error.statusCode = 503;
    throw error;
  }
  const response = await fetch(`${config.supabase.url}/auth/v1/otp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: config.supabase.anonKey },
    body: JSON.stringify({ email, options: { emailRedirectTo: config.appOrigin } }),
  });
  if (!response.ok) throw new Error(`Authentication provider rejected request (${response.status}).`);
  return { accepted: true };
}
