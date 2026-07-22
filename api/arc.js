const ARC_BASE = 'https://three.arcprize.org';

function allowedPath(path) {
  return /^\/api\/(games|scorecard(?:\/.*)?|cmd\/(RESET|ACTION[1-7]))$/.test(path);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }

  const { apiKey, path, method = 'GET', body = null, cookies = '' } = req.body || {};
  if (!apiKey || typeof apiKey !== 'string') {
    res.status(400).json({ error: 'ARC API key required' });
    return;
  }
  if (!path || !allowedPath(path)) {
    res.status(400).json({ error: 'Unsupported ARC endpoint' });
    return;
  }

  const upstream = await fetch(`${ARC_BASE}${path}`, {
    method,
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
      ...(cookies ? { Cookie: cookies } : {}),
    },
    body: method === 'GET' ? undefined : JSON.stringify(body || {}),
  });

  const text = await upstream.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  const setCookies = upstream.headers.getSetCookie?.() || [];
  res.status(upstream.status).json({
    ok: upstream.ok,
    status: upstream.status,
    data,
    cookies: setCookies.map((value) => value.split(';')[0]),
  });
}
