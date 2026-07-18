import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import test from 'node:test';

const cli = new URL('./verify-owned-runtime-health.mjs', import.meta.url).pathname;
const digest = (body) => createHash('sha256').update(body).digest('hex');
const html = Buffer.from('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>ok</body></html>');
const js = Buffer.from('console.log("ok")\n');
const headers = (body, type, overrides = {}) => ({
  'content-type': type,
  'content-security-policy': "default-src 'self'",
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'x-fia-content-sha256': digest(body),
  'x-fia-schema': 'fia.owned-static-runtime-server.v1',
  ...overrides
});
async function fixture(handler) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'fia-health-'));
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const manifest = { schema: 'fia.owned-runtime-health-manifest.v1', probes: [
    { path: '/', kind: 'route', status: 200, mime: 'text/html', sha256: digest(html) },
    { path: '/app.js', kind: 'asset', status: 200, mime: 'text/javascript', sha256: digest(js) }
  ], missingAssetPath: '/missing.js' };
  const manifestPath = path.join(dir, 'manifest.json');
  await writeFile(manifestPath, JSON.stringify(manifest));
  return { dir, server, manifestPath, baseUrl: `http://127.0.0.1:${address.port}` };
}
function run(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cli, ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.on('data', (v) => out += v);
    child.stderr.on('data', (v) => err += v);
    child.on('close', (code) => resolve({ code, out, err }));
  });
}
function goodHandler(req, res) {
  if (req.url === '/') { res.writeHead(200, headers(html, 'text/html; charset=utf-8')); res.end(html); return; }
  if (req.url === '/app.js') { res.writeHead(200, headers(js, 'text/javascript')); res.end(js); return; }
  res.writeHead(404, { 'content-type': 'application/json' }); res.end('{}');
}

test('verifies served bytes, headers, MIME, HTML contract, and missing asset behavior', async () => {
  const f = await fixture(goodHandler); const output = path.join(f.dir, 'out.json');
  try { const result = await run(['--manifest', f.manifestPath, '--baseUrl', f.baseUrl, '--output', output]); assert.equal(result.code, 0, result.err); const evidence = JSON.parse(await readFile(output)); assert.equal(evidence.schema, 'fia.owned-runtime-health.v1'); assert.equal(evidence.probes.length, 2); }
  finally { f.server.close(); }
});

test('equivalent runs produce identical identities', async () => {
  const f = await fixture(goodHandler);
  try { const a = path.join(f.dir, 'a.json'), b = path.join(f.dir, 'b.json'); assert.equal((await run(['--manifest', f.manifestPath, '--baseUrl', f.baseUrl, '--output', a])).code, 0); assert.equal((await run(['--manifest', f.manifestPath, '--baseUrl', f.baseUrl, '--output', b])).code, 0); assert.equal(JSON.parse(await readFile(a)).identity, JSON.parse(await readFile(b)).identity); }
  finally { f.server.close(); }
});

test('rejects served-byte mismatch', async () => {
  const f = await fixture((req, res) => { if (req.url === '/') { const changed = Buffer.from(html.toString().replace('ok', 'changed')); res.writeHead(200, headers(changed, 'text/html')); res.end(changed); } else goodHandler(req, res); });
  try { const r = await run(['--manifest', f.manifestPath, '--baseUrl', f.baseUrl, '--output', path.join(f.dir, 'out.json')]); assert.notEqual(r.code, 0); assert.match(r.err, /digest mismatch/); }
  finally { f.server.close(); }
});

test('rejects missing required security headers', async () => {
  const f = await fixture((req, res) => { if (req.url === '/') { const h = headers(html, 'text/html'); delete h['content-security-policy']; res.writeHead(200, h); res.end(html); } else goodHandler(req, res); });
  try { const r = await run(['--manifest', f.manifestPath, '--baseUrl', f.baseUrl, '--output', path.join(f.dir, 'out.json')]); assert.notEqual(r.code, 0); assert.match(r.err, /missing required header/); }
  finally { f.server.close(); }
});

test('rejects SPA fallback masking a missing asset', async () => {
  const f = await fixture((req, res) => { if (req.url === '/missing.js') { res.writeHead(200, headers(html, 'text/html')); res.end(html); } else goodHandler(req, res); });
  try { const r = await run(['--manifest', f.manifestPath, '--baseUrl', f.baseUrl, '--output', path.join(f.dir, 'out.json')]); assert.notEqual(r.code, 0); assert.match(r.err, /must return 404|masked/); }
  finally { f.server.close(); }
});

test('rejects autoplay and provider coupling in HTML', async () => {
  const bad = Buffer.from('<html lang="en"><head><meta name="viewport" content="width=device-width"></head><body><audio autoplay src="https://vercel.app/a.mp3"></audio></body></html>');
  const f = await fixture((req, res) => { if (req.url === '/') { res.writeHead(200, headers(bad, 'text/html')); res.end(bad); } else goodHandler(req, res); });
  const manifest = JSON.parse(await readFile(f.manifestPath)); manifest.probes[0].sha256 = digest(bad); await writeFile(f.manifestPath, JSON.stringify(manifest));
  try { const r = await run(['--manifest', f.manifestPath, '--baseUrl', f.baseUrl, '--output', path.join(f.dir, 'out.json')]); assert.notEqual(r.code, 0); assert.match(r.err, /HTML contract/); }
  finally { f.server.close(); }
});

test('refuses to overwrite retained evidence', async () => {
  const f = await fixture(goodHandler); const output = path.join(f.dir, 'out.json'); await writeFile(output, 'sentinel');
  try { const r = await run(['--manifest', f.manifestPath, '--baseUrl', f.baseUrl, '--output', output]); assert.notEqual(r.code, 0); assert.equal(await readFile(output, 'utf8'), 'sentinel'); }
  finally { f.server.close(); }
});
