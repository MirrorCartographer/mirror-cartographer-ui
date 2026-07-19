#!/usr/bin/env node
import { createHash, randomBytes } from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { readFile, writeFile, mkdir, rename, rm, lstat } from 'node:fs/promises';

const ROUTE_SCHEMA = 'fia.owned-listener-route.v1';
const STATE_SCHEMA = 'fia.owned-routing-proxy-state.v1';
const SERVER_SCHEMA = 'fia.owned-routing-proxy.v1';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
function stableBytes(value) { return Buffer.from(JSON.stringify(canonical(value))); }
function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function fail(message) { throw new Error(message); }
function requireSha(value, label) { if (!/^[a-f0-9]{64}$/.test(value ?? '')) fail(`${label} must be sha256`); }
function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 2) {
    if (!argv[i]?.startsWith('--') || argv[i + 1] === undefined) fail(`invalid argument near ${argv[i] ?? '<end>'}`);
    out[argv[i].slice(2)] = argv[i + 1];
  }
  return out;
}
function routeIdentity(route) {
  const base = canonical({ schema: route.schema, releaseIdentity: route.releaseIdentity, listenerId: route.listenerId, contentSha256: route.contentSha256, host: route.host, port: route.port });
  return sha256(stableBytes(base));
}
function validateRoute(route) {
  if (!route || typeof route !== 'object' || Array.isArray(route)) fail('route must be an object');
  if (route.schema !== ROUTE_SCHEMA) fail(`route must be ${ROUTE_SCHEMA}`);
  const keys = Object.keys(route).sort().join(',');
  if (keys !== 'contentSha256,host,listenerId,port,releaseIdentity,schema') fail('route contains missing or unknown fields');
  requireSha(route.releaseIdentity, 'route.releaseIdentity');
  requireSha(route.listenerId, 'route.listenerId');
  requireSha(route.contentSha256, 'route.contentSha256');
  if (route.host !== '127.0.0.1' && route.host !== '::1') fail('route host must be loopback');
  if (!Number.isInteger(route.port) || route.port < 1 || route.port > 65535) fail('route port invalid');
  return canonical(route);
}
async function loadRoute(routeStatePath) {
  const bytes = await readFile(routeStatePath);
  const route = validateRoute(JSON.parse(bytes));
  return { route, fileSha256: sha256(bytes), routeIdentity: routeIdentity(route) };
}
async function writeExclusiveAtomic(file, payload) {
  await mkdir(path.dirname(file), { recursive: true });
  try { await lstat(file); fail(`refusing to overwrite ${file}`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const tmp = `${file}.tmp-${process.pid}-${randomBytes(6).toString('hex')}`;
  await writeFile(tmp, payload, { flag: 'wx', mode: 0o600 });
  try { await rename(tmp, file); } catch (error) { await rm(tmp, { force: true }); throw error; }
}
function sanitizeHeaders(headers) {
  const denied = new Set(['connection', 'proxy-connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'te', 'trailer']);
  const out = {};
  for (const [name, value] of Object.entries(headers)) if (!denied.has(name.toLowerCase()) && value !== undefined) out[name] = value;
  out['cache-control'] = 'no-store';
  out['pragma'] = 'no-cache';
  out['x-fia-proxy-schema'] = SERVER_SCHEMA;
  return out;
}
function forward({ request, response, routeRecord, timeoutMs, maxResponseBytes, proxyIdentity }) {
  return new Promise(resolve => {
    const headers = sanitizeHeaders(request.headers);
    headers.host = `${routeRecord.route.host}:${routeRecord.route.port}`;
    headers['x-fia-route-identity'] = routeRecord.routeIdentity;
    headers['x-fia-expected-listener-id'] = routeRecord.route.listenerId;
    const upstream = http.request({ host: routeRecord.route.host, port: routeRecord.route.port, method: request.method, path: request.url, headers }, upstreamResponse => {
      let total = 0;
      let completed = false;
      const finish = result => { if (!completed) { completed = true; resolve(result); } };
      const upstreamListenerId = upstreamResponse.headers['x-fia-listener-id'];
      if (upstreamListenerId !== routeRecord.route.listenerId) {
        upstreamResponse.destroy();
        response.writeHead(502, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-fia-proxy-schema': SERVER_SCHEMA });
        response.end('upstream listener identity mismatch\n');
        finish({ ok: false, reason: 'listener-mismatch' });
        return;
      }
      const responseHeaders = sanitizeHeaders(upstreamResponse.headers);
      responseHeaders['x-fia-proxy-identity'] = proxyIdentity;
      responseHeaders['x-fia-route-identity'] = routeRecord.routeIdentity;
      responseHeaders['x-fia-route-file-sha256'] = routeRecord.fileSha256;
      responseHeaders['x-fia-active-listener-id'] = routeRecord.route.listenerId;
      response.writeHead(upstreamResponse.statusCode ?? 502, responseHeaders);
      upstreamResponse.on('data', chunk => {
        total += chunk.length;
        if (total > maxResponseBytes) {
          upstreamResponse.destroy();
          response.destroy(new Error('upstream response exceeds maximum bytes'));
          finish({ ok: false, reason: 'response-limit' });
          return;
        }
        if (!response.write(chunk)) upstreamResponse.pause();
      });
      response.on('drain', () => upstreamResponse.resume());
      upstreamResponse.on('end', () => { response.end(); finish({ ok: true, bytes: total }); });
      upstreamResponse.on('error', () => { if (!response.headersSent) response.writeHead(502); response.end(); finish({ ok: false, reason: 'upstream-error' }); });
    });
    upstream.setTimeout(timeoutMs, () => upstream.destroy(new Error('upstream timeout')));
    upstream.on('error', () => {
      if (!response.headersSent) response.writeHead(502, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-fia-proxy-schema': SERVER_SCHEMA });
      response.end('upstream unavailable\n');
      resolve({ ok: false, reason: 'connection-error' });
    });
    request.on('aborted', () => upstream.destroy());
    request.pipe(upstream);
  });
}

export async function startProxy({ routeStatePath, host = '127.0.0.1', port = 0, timeoutMs = 5000, maxResponseBytes = 64 * 1024 * 1024, stateOutputPath = '', logger = () => {} }) {
  if (host !== '127.0.0.1' && host !== '::1') fail('proxy host must be loopback');
  if (!Number.isInteger(port) || port < 0 || port > 65535) fail('proxy port invalid');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 600000) fail('timeoutMs out of range');
  if (!Number.isInteger(maxResponseBytes) || maxResponseBytes < 1 || maxResponseBytes > 1024 * 1024 * 1024) fail('maxResponseBytes out of range');
  const initial = await loadRoute(routeStatePath);
  const policy = canonical({ routeStatePath: path.resolve(routeStatePath), host, timeoutMs, maxResponseBytes, routeReload: 'every-request', cache: 'disabled', upstreamIdentityRequired: true });
  const proxyIdentity = sha256(stableBytes({ schema: SERVER_SCHEMA, policy: { ...policy, routeStatePath: '<owned-route-state>' } }));
  const server = http.createServer(async (request, response) => {
    try {
      const record = await loadRoute(routeStatePath);
      await forward({ request, response, routeRecord: record, timeoutMs, maxResponseBytes, proxyIdentity });
    } catch (error) {
      logger(error);
      if (!response.headersSent) response.writeHead(503, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-fia-proxy-schema': SERVER_SCHEMA, 'x-fia-proxy-identity': proxyIdentity });
      response.end('routing state unavailable\n');
    }
  });
  server.on('clientError', (_error, socket) => socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'));
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); });
  const address = server.address();
  const startupBase = canonical({ schema: STATE_SCHEMA, proxyIdentity, host, port: address.port, initialRouteIdentity: initial.routeIdentity, initialRouteFileSha256: initial.fileSha256, policy: { routeReload: 'every-request', partialReadsFailClosed: true, upstreamListenerIdentityRequired: true, responseCaching: false, backpressurePreserved: true, timeoutMs, maxResponseBytes } });
  const startup = { ...startupBase, identity: sha256(stableBytes(startupBase)) };
  try {
    if (stateOutputPath) await writeExclusiveAtomic(stateOutputPath, `${JSON.stringify(startup, null, 2)}\n`);
    return { server, startup };
  } catch (error) {
    await new Promise(resolve => server.close(resolve));
    throw error;
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.routeState) fail('--routeState required');
  const started = await startProxy({ routeStatePath: args.routeState, host: args.host ?? '127.0.0.1', port: Number(args.port ?? 8080), timeoutMs: Number(args.timeoutMs ?? 5000), maxResponseBytes: Number(args.maxResponseBytes ?? 64 * 1024 * 1024), stateOutputPath: args.output ?? '' });
  process.stdout.write(`${JSON.stringify(started.startup)}\n`);
  const shutdown = () => started.server.close(() => process.exit(0));
  process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
}
if (process.argv[1] === new URL(import.meta.url).pathname) main().catch(error => { process.stderr.write(`${error.stack ?? error.message}\n`); process.exit(1); });
