import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { startProxy } from './serve-owned-routing-proxy.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const id = char => char.repeat(64);
async function atomicWrite(file, value) { const tmp = `${file}.tmp`; await writeFile(tmp, value); await import('node:fs/promises').then(fs => fs.rename(tmp, file)); }
function route(port, listenerId = id('b'), contentSha256 = id('c')) { return { schema: 'fia.owned-listener-route.v1', releaseIdentity: id('a'), listenerId, contentSha256, host: '127.0.0.1', port }; }
async function listener(body, listenerId = id('b')) {
  const server = http.createServer((_req, res) => { res.writeHead(200, { 'content-type': 'text/plain', 'x-fia-listener-id': listenerId, 'x-fia-content-sha256': sha(body) }); res.end(body); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return server;
}
async function get(port, pathname = '/') { return new Promise((resolve, reject) => { http.get({ host: '127.0.0.1', port, path: pathname }, res => { const chunks=[]; res.on('data', c=>chunks.push(c)); res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString()})); }).on('error', reject); }); }
async function fixture() { const dir = await mkdtemp(path.join(os.tmpdir(), 'fia-proxy-')); return { dir, routePath: path.join(dir, 'route.json'), statePath: path.join(dir, 'state.json') }; }

async function close(server) { if (server) await new Promise(resolve => server.close(resolve)); }

test('proxies bytes and publishes route/proxy identities', async () => {
  const f = await fixture(); const upstream = await listener('alpha');
  await writeFile(f.routePath, JSON.stringify(route(upstream.address().port)));
  const proxy = await startProxy({ routeStatePath: f.routePath, port: 0, stateOutputPath: f.statePath });
  const res = await get(proxy.server.address().port);
  assert.equal(res.status, 200); assert.equal(res.body, 'alpha');
  assert.equal(res.headers['x-fia-active-listener-id'], id('b'));
  assert.match(res.headers['x-fia-route-identity'], /^[a-f0-9]{64}$/);
  assert.equal(res.headers['cache-control'], 'no-store');
  const state = JSON.parse(await readFile(f.statePath)); assert.equal(state.schema, 'fia.owned-routing-proxy-state.v1');
  await close(proxy.server); await close(upstream); await rm(f.dir, { recursive: true });
});

test('adopts an atomically replaced route on the next request', async () => {
  const f = await fixture(); const a = await listener('alpha', id('b')); const b = await listener('beta', id('d'));
  await writeFile(f.routePath, JSON.stringify(route(a.address().port, id('b'))));
  const proxy = await startProxy({ routeStatePath: f.routePath, port: 0 });
  assert.equal((await get(proxy.server.address().port)).body, 'alpha');
  await atomicWrite(f.routePath, JSON.stringify(route(b.address().port, id('d'), id('e'))));
  const second = await get(proxy.server.address().port); assert.equal(second.body, 'beta'); assert.equal(second.headers['x-fia-active-listener-id'], id('d'));
  await close(proxy.server); await close(a); await close(b); await rm(f.dir, { recursive: true });
});

test('fails closed for malformed or partial route state', async () => {
  const f = await fixture(); const upstream = await listener('alpha');
  await writeFile(f.routePath, JSON.stringify(route(upstream.address().port)));
  const proxy = await startProxy({ routeStatePath: f.routePath, port: 0 });
  await atomicWrite(f.routePath, '{"schema":');
  const res = await get(proxy.server.address().port); assert.equal(res.status, 503); assert.equal(res.body, 'routing state unavailable\n');
  await close(proxy.server); await close(upstream); await rm(f.dir, { recursive: true });
});

test('rejects upstream listener identity substitution', async () => {
  const f = await fixture(); const upstream = await listener('alpha', id('d'));
  await writeFile(f.routePath, JSON.stringify(route(upstream.address().port, id('b'))));
  const proxy = await startProxy({ routeStatePath: f.routePath, port: 0 });
  const res = await get(proxy.server.address().port); assert.equal(res.status, 502); assert.match(res.body, /identity mismatch/);
  await close(proxy.server); await close(upstream); await rm(f.dir, { recursive: true });
});

test('rejects non-loopback and ambiguous route records', async () => {
  const f = await fixture();
  await writeFile(f.routePath, JSON.stringify({ ...route(1234), host: '0.0.0.0' }));
  await assert.rejects(() => startProxy({ routeStatePath: f.routePath, port: 0 }), /loopback/);
  await writeFile(f.routePath, JSON.stringify({ ...route(1234), extra: true }));
  await assert.rejects(() => startProxy({ routeStatePath: f.routePath, port: 0 }), /unknown fields/);
  await rm(f.dir, { recursive: true });
});

test('refuses to overwrite retained proxy-state evidence', async () => {
  const f = await fixture(); const upstream = await listener('alpha');
  await writeFile(f.routePath, JSON.stringify(route(upstream.address().port))); await writeFile(f.statePath, 'retained');
  await assert.rejects(() => startProxy({ routeStatePath: f.routePath, port: 0, stateOutputPath: f.statePath }), /refusing to overwrite/);
  assert.equal(await readFile(f.statePath, 'utf8'), 'retained');
  await close(upstream); await rm(f.dir, { recursive: true });
});
