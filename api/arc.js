const ARC_BASE = 'https://three.arcprize.org';

function allowedPath(path) {
  return /^\/api\/(games|scorecard(?:\/.*)?|cmd\/(RESET|ACTION[1-7]))$/.test(path);
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (!origin || !host) return true;
  try { return new URL(origin).host === host; } catch { return false; }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    res.status(200).json({
      configured: Boolean(process.env.ARC_API_KEY),
      mode: process.env.ARC_API_KEY ? 'server-secret' : 'browser-ephemeral',
    });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'GET or POST only' });
    return;
  }
  if (!sameOrigin(req)) {
    res.status(403).json({ error: 'Same-origin request required' });
    return;
  }

  const { apiKey: ephemeralApiKey, path, method = 'GET', body = null, cookies = '' } = req.body || {};
  const apiKey = process.env.ARC_API_KEY || ephemeralApiKey;

  if (!apiKey || typeof apiKey !== 'string') {
    res.status(503).json({ error: 'ARC credential is not configured' });
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