import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, resolve } from 'node:path';

const root = resolve(process.env.FIA_ROOT || 'dist');
const port = Number(process.env.PORT || 8080);
const host = process.env.HOST || '0.0.0.0';
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

const server = createServer((request, response) => {
  const url = new URL(request.url || '/', 'http://localhost');
  if (url.pathname === '/_health') {
    response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(JSON.stringify({ ok: true, runtime: 'foundation-intelligence-owned-server/v1' }));
    return;
  }

  const safePath = decodeURIComponent(url.pathname).replace(/^\/+/, '').replace(/\.\.(\/|\\)/g, '');
  let file = resolve(root, safePath || 'index.html');
  if (!file.startsWith(root)) {
    response.writeHead(403); response.end('Forbidden'); return;
  }
  if (!existsSync(file) || statSync(file).isDirectory()) file = resolve(root, 'index.html');
  const extension = extname(file).toLowerCase();
  response.writeHead(200, {
    'content-type': mime[extension] || 'application/octet-stream',
    'cache-control': extension === '.html' ? 'no-store' : 'public, max-age=31536000, immutable',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  });
  createReadStream(file).pipe(response);
});

server.listen(port, host, () => console.log(`FIA runtime listening on http://${host}:${port}`));
