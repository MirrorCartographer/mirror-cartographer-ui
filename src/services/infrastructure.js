const TOKEN_KEY = 'mirror-cartographer.session.v1';

async function request(action, { method = 'GET', token, body, query = {} } = {}) {
  const url = new URL('/api', window.location.origin);
  url.searchParams.set('action', action);
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  });
  const response = await fetch(url, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `Infrastructure request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

export function createInfrastructureClient(storage = window.localStorage) {
  const getToken = () => storage.getItem(TOKEN_KEY) || '';
  const setToken = (token) => token ? storage.setItem(TOKEN_KEY, token) : storage.removeItem(TOKEN_KEY);

  return {
    get token() { return getToken(); },
    signOut() { setToken(''); },
    health: () => request('health'),
    publicConfig: () => request('config.public'),
    requestMagicLink: (email) => request('auth.magic-link', { method: 'POST', body: { email } }),
    async developmentSignIn(email) {
      const result = await request('auth.development', { method: 'POST', body: { email } });
      setToken(result.token);
      return result;
    },
    list: (collection, search = '') => request('records.list', { token: getToken(), query: { collection, search } }),
    upsert: (collection, record) => request('records.upsert', { method: 'POST', token: getToken(), body: { collection, record } }),
    remove: (collection, id) => request('records.delete', { method: 'POST', token: getToken(), body: { collection, id } }),
    exportAll: () => request('records.export', { token: getToken() }),
    prepareUpload: (file) => request('uploads.prepare', {
      method: 'POST', token: getToken(), body: { name: file.name, size: file.size, type: file.type },
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
