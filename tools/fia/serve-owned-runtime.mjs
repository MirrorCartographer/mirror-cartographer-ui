#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCHEMA = 'fia.owned-static-runtime-server.v1';

const MIME = new Map([
  ['.css', 'text/css; charset=utf-8'], ['.gif', 'image/gif'], ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'], ['.mjs', 'text/javascript; charset=utf-8'], ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'], ['.txt', 'text/plain; charset=utf-8'], ['.wasm', 'application/wasm'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'], ['.webp', 'image/webp'], ['.woff', 'font/woff'], ['.woff2', 'font/woff2']
]);

const SECURITY_HEADERS = Object.freeze({
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY'
});

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function inside(root, candidate) {
  const rel = relative(root, candidate);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !rel.startsWith(sep));
}

function assertNoSymlink(root, candidate) {
  let current = root;
  const rel = relative(root, candidate);
  if (!inside(root, candidate)) throw new Error('path escapes active runtime');
  for (const segment of rel.split(sep).filter(Boolean)) {
    current = join(current, segment);
    if (lstatSync(current).isSymbolicLink()) throw new Error(`symlink rejected: ${relative(root, current)}`);
  }
}

export function resolveActiveRuntime(stateDir) {
  const root = realpathSync(resolve(stateDir));
  const activePath = join(root, 'active');
  if (!existsSync(activePath) || !lstatSync(activePath).isSymbolicLink()) throw new Error('active release pointer is missing or not a symlink');
  const runtime = realpathSync(activePath);
  const releases = realpathSync(join(root, 'releases'));
  if (!inside(releases, runtime) || runtime === releases) throw new Error('active release pointer escapes releases directory');
  if (!lstatSync(runtime).isDirectory()) throw new Error('active release target is not a directory');
  return { root, runtime };
}

function requestPath(url) {
  const raw = new URL(url, 'http://runtime.invalid').pathname;
  let decoded;
  try { decoded = decodeURIComponent(raw); } catch { throw Object.assign(new Error('invalid URL encoding'), { statusCode: 400 }); }
  if (decoded.includes('\0') || decoded.includes('\\')) throw Object.assign(new Error('invalid path'), { statusCode: 400 });
  const normalized = normalize(decoded).replace(/^([/\\])+/, '');
  if (normalized === '..' || normalized.startsWith(`..${sep}`)) throw Object.assign(new Error('path traversal rejected'), { statusCode: 403 });
  return normalized || 'index.html';
}

function acceptsHtml(req) {
  return String(req.headers.accept || '').split(',').some((entry) => entry.trim().startsWith('text/html'));
}

export function createOwnedRuntimeServer({ stateDir, spaFallback = true }) {
  const { runtime } = resolveActiveRuntime(stateDir);
  const server = createServer((req, res) => {
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Security-Policy', "default-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; media-src 'self'; connect-src 'self'");

    if (!['GET', 'HEAD'].includes(req.method || '')) {
      res.writeHead(405, { Allow: 'GET, HEAD' }); res.end(); return;
    }

    try {
      const requested = requestPath(req.url || '/');
      let candidate = resolve(runtime, requested);
      if (!inside(runtime, candidate)) throw Object.assign(new Error('path traversal rejected'), { statusCode: 403 });

      let fallback = false;
      if (existsSync(candidate) && lstatSync(candidate).isSymbolicLink()) throw new Error(`symlink rejected: ${relative(runtime, candidate)}`);
      if (!existsSync(candidate) || !lstatSync(candidate).isFile()) {
        const extensionless = extname(requested) === '';
        if (spaFallback && extensionless && acceptsHtml(req)) {
          candidate = join(runtime, 'index.html'); fallback = true;
        } else {
          res.writeHead(404); res.end('Not found'); return;
        }
      }

      assertNoSymlink(runtime, candidate);
      const stat = lstatSync(candidate);
      const digest = sha256File(candidate);
      res.setHeader('Content-Type', MIME.get(extname(candidate).toLowerCase()) || 'application/octet-stream');
      res.setHeader('Content-Length', stat.size);
      res.setHeader('ETag', `"sha256-${digest}"`);
      res.setHeader('X-FIA-Content-SHA256', digest);
      res.setHeader('X-FIA-Schema', SCHEMA);
      if (fallback) res.setHeader('X-FIA-SPA-Fallback', '1');
      res.writeHead(200);
      if (req.method === 'HEAD') res.end(); else createReadStream(candidate).pipe(res);
    } catch (error) {
      const status = Number(error.statusCode) || 500;
      res.writeHead(status); res.end(status >= 500 ? 'Runtime error' : error.message);
    }
  });
  return { server, runtime };
}

function parseArgs(argv) {
  const out = { host: '127.0.0.1', port: 8080, spaFallback: true };
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]; const value = argv[i + 1];
    if (!key?.startsWith('--') || value === undefined) throw new Error(`invalid argument near ${key}`);
    if (key === '--stateDir') out.stateDir = value;
    else if (key === '--host') out.host = value;
    else if (key === '--port') out.port = Number(value);
    else if (key === '--spaFallback') out.spaFallback = value !== 'false';
    else throw new Error(`unknown argument ${key}`);
  }
  if (!out.stateDir) throw new Error('--stateDir is required');
  if (!Number.isInteger(out.port) || out.port < 0 || out.port > 65535) throw new Error('--port must be an integer from 0 to 65535');
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const { server, runtime } = createOwnedRuntimeServer(options);
    server.listen(options.port, options.host, () => {
      const address = server.address();
      process.stdout.write(`${JSON.stringify({ schema: SCHEMA, host: options.host, port: address.port, runtime })}\n`);
    });
    const stop = () => server.close(() => process.exit(0));
    process.on('SIGINT', stop); process.on('SIGTERM', stop);
  } catch (error) {
    process.stderr.write(`${error.message}\n`); process.exit(1);
  }
}
