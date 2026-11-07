const encoder = new TextEncoder();
const decoder = new TextDecoder();

function encodeBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, '').replace(/\\+/g, '-').replace(/\\//g, '_');
}

function decodeBase64Url(value) {
  const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function importHmacKey(secret, usages) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, usages);
}

async function signature(data, secret) {
  const key = await importHmacKey(secret, ['sign']);
  return encodeBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(data))));
}

async function validSignature(data, provided, secret) {
  try {
    const key = await importHmacKey(secret, ['verify']);
    return await crypto.subtle.verify('HMAC', key, decodeBase64Url(provided), encoder.encode(data));
  } catch {
    return false;
  }
}

export async function issueDevelopmentSession(identity, config, ttlSeconds = 60 * 60 * 24 * 7) {
  if (config.production) throw new Error('Development sessions are disabled in production.');
  const now = Math.floor(Date.now() / 1000);
  const payload = encodeBase64Url(encoder.encode(JSON.stringify({
    sub: identity.id || crypto.randomUUID(),
    email: identity.email || 'local@mirrorcartographer.test',
    role: 'authenticated',
    iat: now,
    exp: now + ttlSeconds,
    provider: 'development',
  })));
  return `${payload}.${await signature(payload, config.sessionSecret)}`;
}

export async function verifyDevelopmentSession(token, config) {
  const [payload, provided] = String(token || '').split('.');
  if (!payload || !provided || !(await validSignature(payload, provided, config.sessionSecret))) return null;
  try {
    const identity = JSON.parse(decoder.decode(decodeBase64Url(payload)));
    if (!identity.exp || identity.exp < Math.floor(Date.now() / 1000)) return null;
    return identity;
  } catch {
    return null;
  }
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
  const headers = req.headers;
  const authorization = String(typeof headers?.get === 'function' ? headers.get('authorization') || '' : headers?.authorization || '');
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) {
    if (optional) return null;
    const error = new Error('Authentication required.');
    error.statusCode = 401;
    throw error;
  }

  const development = await verifyDevelopmentSession(token, config);
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
