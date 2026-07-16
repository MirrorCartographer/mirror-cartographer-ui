#!/usr/bin/env node
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { extname, join, normalize, relative, resolve, sep } from 'node:path';
import process from 'node:process';

const MIME = Object.freeze({
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
});

function parseArgs(argv) {
  const args = { root: 'dist', host: '127.0.0.1', port: 4173, spa: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--root') args.root = argv[++i];
    else if (token === '--host') args.host = argv[++i];
    else if (token === '--port') args.port = Number(argv[++i]);
    else if (token === '--spa') args.spa = true;
    else if (token === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  if (!args.root) throw new Error('--root requires a value');
  if (!args.host) throw new Error('--host requires a value');
  if (!Number.isInteger(args.port) || args.port < 0 || args.port > 65535) {
    throw new Error('--port must be an integer from 0 through 65535');
  }
  return args;
}

function securityHeaders(contentType) {
  return {
    'Content-Security-Policy': "default-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'",
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), microphone=(), payment=(), usb=()',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    ...(contentType ? { 'Content-Type': contentType } : {}),
  };
}

function isHashedAsset(pathname) {
  return /\.[a-f0-9]{8,}\.[^./]+$/i.test(pathname);
}

function cacheControl(pathname) {
  if (pathname.endsWith('.html') || pathname.endsWith('.webmanifest')) return 'no-cache';
  if (isHashedAsset(pathname)) return 'public, max-age=31536000, immutable';
  return 'public, max-age=3600';
}

function safeCandidate(root, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes('\0') || decoded.includes('\\')) return null;
  const normalized = normalize(decoded).replace(/^([/\\])+/, '');
  const candidate = resolve(root, normalized || 'index.html');
  const rel = relative(root, candidate);
  if (rel === '..' || rel.startsWith(`..${sep}`) || rel.includes(`${sep}..${sep}`)) return null;
  return candidate;
}

async function resolveFile(root, pathname, spa) {
  const candidate = safeCandidate(root, pathname);
  if (!candidate) return { status: 400 };

  let selected = candidate;
  try {
    const info = await stat(selected);
    if (info.isDirectory()) selected = join(selected, 'index.html');
  } catch {
    if (spa) selected = join(root, 'index.html');
    else return { status: 404 };
  }

  try {
    const [rootReal, fileReal] = await Promise.all([realpath(root), realpath(selected)]);
    const rel = relative(rootReal, fileReal);
    if (rel === '..' || rel.startsWith(`..${sep}`)) return { status: 403 };
    const info = await stat(fileReal);
    if (!info.isFile()) return { status: 404 };
    return { status: 200, path: fileReal, size: info.size };
  } catch {
    return { status: 404 };
  }
}

function writeError(response, status, method = 'GET') {
  const body = `${status}\n`;
  response.writeHead(status, {
    ...securityHeaders('text/plain; charset=utf-8'),
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
  });
  if (method === 'HEAD') response.end();
  else response.end(body);
}

export async function createStaticRuntime(options = {}) {
  const root = resolve(options.root ?? 'dist');
  const host = options.host ?? '127.0.0.1';
  const port = options.port ?? 4173;
  const spa = Boolean(options.spa);

  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new Error(`Static root is not a directory: ${root}`);
  }

  const server = createServer(async (request, response) => {
    const method = request.method ?? 'GET';
    if (method !== 'GET' && method !== 'HEAD') {
      response.setHeader('Allow', 'GET, HEAD');
      writeError(response, 405, method);
      return;
    }

    const requestUrl = new URL(request.url ?? '/', 'http://runtime.invalid');
    const result = await resolveFile(root, requestUrl.pathname, spa);
    if (result.status !== 200) {
      writeError(response, result.status, method);
      return;
    }

    const type = MIME[extname(result.path).toLowerCase()] ?? 'application/octet-stream';
    response.writeHead(200, {
      ...securityHeaders(type),
      'Cache-Control': cacheControl(result.path),
      'Content-Length': result.size,
    });
    if (method === 'HEAD') response.end();
    else createReadStream(result.path).pipe(response);
  });

  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolveListen);
  });

  return {
    server,
    address: server.address(),
    close: () => new Promise((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose())),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write('Usage: node tools/fia/serve-static.mjs [--root dist] [--host 127.0.0.1] [--port 4173] [--spa]\n');
    return;
  }
  const runtime = await createStaticRuntime(args);
  const address = runtime.address;
  process.stdout.write(JSON.stringify({
    schema: 'fia.static-runtime.v1',
    root: resolve(args.root),
    host: typeof address === 'object' && address ? address.address : args.host,
    port: typeof address === 'object' && address ? address.port : args.port,
    spa: args.spa,
  }) + '\n');

  const shutdown = async signal => {
    process.stdout.write(JSON.stringify({ schema: 'fia.static-runtime.shutdown.v1', signal }) + '\n');
    await runtime.close();
    process.exitCode = 0;
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  main().catch(error => {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  });
}
