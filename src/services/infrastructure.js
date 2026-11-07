const TOKEN_KEY = 'mirror-cartographer.session.v1';
const REFRESH_KEY = 'mirror-cartographer.refresh.v1';
const buildEnv = import.meta.env || {};
const SUPABASE_URL = String(buildEnv.VITE_SUPABASE_URL || '').replace(/\\/$/, '');
const SUPABASE_ANON_KEY = String(buildEnv.VITE_SUPABASE_ANON_KEY || '');
const API_URL = String(buildEnv.VITE_SUPABASE_FUNCTION_URL || (SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/api` : '')).trim();

function endpoint(action, query = {}) {
  if (!API_URL) {
    const error = new Error('Supabase persistence is not configured for this build. Your current workspace remains local to this browser.');
    error.status = 503;
    throw error;
  }
  const url = new URL(API_URL);
  url.searchParams.set('action', action);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  });
  return url;
}

export function createInfrastructureClient(storage = window.localStorage) {
  const getToken = () => storage.getItem(TOKEN_KEY) || '';
  const getRefreshToken = () => storage.getItem(REFRESH_KEY) || '';
  const setSession = (accessToken, refreshToken = '') => {
    if (accessToken) storage.setItem(TOKEN_KEY, accessToken);
    else storage.removeItem(TOKEN_KEY);
    if (refreshToken) storage.setItem(REFRESH_KEY, refreshToken);
    else if (!accessToken) storage.removeItem(REFRESH_KEY);
  };

  async function refreshSession() {
    const refreshToken = getRefreshToken();
    if (!refreshToken || !SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
    try {
      const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: { apikey: SUPABASE_ANON_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!response.ok) {
        setSession('');
        return false;
      }
      const result = await response.json();
      setSession(result.access_token, result.refresh_token);
      return Boolean(result.access_token);
    } catch {
      return false;
    }
  }

  async function request(action, { method = 'GET', token = getToken(), body, query = {} } = {}, allowRefresh = true) {
    const url = endpoint(action, query);
    const response = await fetch(url, {
      method,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (response.status === 401 && allowRefresh && getRefreshToken() && await refreshSession()) {
      return request(action, { method, token: getToken(), body, query }, false);
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || `Infrastructure request failed (${response.status}).`);
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  function consumeAuthCallback() {
    if (typeof window === 'undefined' || !window.location.hash) return { consumed: false };
    const params = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const errorDescription = params.get('error_description');
    if (errorDescription) {
      window.history.replaceState({}, '', window.location.pathname + window.location.search);
      return { consumed: true, error: errorDescription };
    }
    if (!accessToken) return { consumed: false };
    setSession(accessToken, refreshToken || '');
    window.history.replaceState({}, '', window.location.pathname + window.location.search);
    return { consumed: true, authenticated: true };
  }

  return {
    get token() { return getToken(); },
    get configured() { return Boolean(API_URL); },
    signOut() { setSession(''); },
    consumeAuthCallback,
    health: async () => {
      if (!API_URL) return { ok: false, configured: false, persistence: 'local-only', message: 'Supabase Edge Function URL is not configured.' };
      return request('health', { token: '' });
    },
    publicConfig: async () => {
      if (!API_URL) return { persistence: 'local-only', uploadLimit: 0, payments: {} };
      return request('config.public', { token: '' });
    },
    requestMagicLink: (email) => request('auth.magic-link', { method: 'POST', token: '', body: { email } }),
    async developmentSignIn(email) {
      const result = await request('auth.development', { method: 'POST', token: '', body: { email } });
      setSession(result.token, '');
      return result;
    },
    list: (collection, search = '') => request('records.list', { query: { collection, search } }),
    upsert: (collection, record) => request('records.upsert', { method: 'POST', body: { collection, record } }),
    remove: (collection, id) => request('records.delete', { method: 'POST', body: { collection, id } }),
    exportAll: () => request('records.export'),
    prepareUpload: (file) => request('uploads.prepare', {
      method: 'POST', body: { name: file.name, size: file.size, type: file.type },
    }),
    async upload(file) {
      const prepared = await this.prepareUpload(file);
      if (!prepared.uploadUrl) return { ...prepared, file };
      const response = await fetch(prepared.uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': file.type || 'application/octet-stream', ...(prepared.token ? { 'x-upsert': 'false' } : {}) },
        body: file,
      });
      if (!response.ok) throw new Error(`File upload failed (${response.status}).`);
      return prepared;
    },
  };
}

export const infrastructure = typeof window === 'undefined' ? null : createInfrastructureClient();
