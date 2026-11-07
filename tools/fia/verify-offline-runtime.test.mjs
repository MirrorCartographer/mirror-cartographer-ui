import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const tool = path.join(path.dirname(fileURLToPath(import.meta.url)), 'verify-offline-runtime.mjs');
const sha = b => createHash('sha256').update(b).digest('hex');
const canonical = v => Array.isArray(v) ? `[${v.map(canonical).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}` : JSON.stringify(v);
const id = v => { const c = structuredClone(v); delete c.identity; return sha(canonical(c)); };

async function fixture() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'fia-offline-'));
  const root = path.join(dir, 'dist');
  await mkdir(path.join(root, 'assets'), { recursive: true });
  const files = {
    'index.html': '<html lang="en"><meta name="viewport" content="width=device-width">home',
    'offline.html': '<html lang="en"><meta name="viewport" content="width=device-width">offline',
    'assets/app.js': 'console.log("ok")'
  };
  for (const [p, c] of Object.entries(files)) await writeFile(path.join(root, p), c);
  const entries = [['/', 'index.html', 'document'], ['/offline.html', 'offline.html', 'offline'], ['/assets/app.js', 'assets/app.js', 'asset']]
    .map(([url, p, role]) => ({ url, path: p, role, size: Buffer.byteLength(files[p]), sha256: sha(files[p]) }));
  const b = {
    schema: 'fia.offline-runtime-bundle.v1', manifestIdentity: 'a'.repeat(64), cacheIdentity: 'b'.repeat(64),
    cacheName: `fia-${'b'.repeat(64)}`, entries, offlineFallback: '/offline.html',
    serviceWorker: { schema: 'fia.offline-service-worker.v1', sha256: 'c'.repeat(64) }, policy: { sameOriginOnly: true }
  };
  b.identity = id(b);
  const bp = path.join(dir, 'bundle.json');
  await writeFile(bp, canonical(b));
  return { dir, root, bp, b };
}
function run(f, out, extra = []) {
  return spawnSync(process.execPath, [tool, '--bundle', f.bp, '--root', f.root, '--output', out, ...extra], { encoding: 'utf8' });
}

test('verifies install, activation, asset miss, navigation fallback, and rollback', async () => {
  const f = await fixture(); const out = path.join(f.dir, 'out.json'); const r = run(f, out);
  assert.equal(r.status, 0, r.stderr); const e = JSON.parse(await readFile(out));
  assert.equal(e.install.committed, true); assert.equal(e.probes.at(-2).result, 'miss');
  assert.equal(e.probes.at(-1).result, 'fallback'); assert.equal(e.rollback.newerCacheRemoved, true);
});
test('equivalent independent runs have identical identities', async () => {
  const a = await fixture(), b = await fixture(); const ao = path.join(a.dir, 'o'), bo = path.join(b.dir, 'o');
  assert.equal(run(a, ao).status, 0); assert.equal(run(b, bo).status, 0);
  assert.equal(JSON.parse(await readFile(ao)).identity, JSON.parse(await readFile(bo)).identity);
});
test('digest substitution fails closed', async () => {
  const f = await fixture(); await writeFile(path.join(f.root, 'assets/app.js'), 'tampered');
  const r = run(f, path.join(f.dir, 'o')); assert.notEqual(r.status, 0); assert.match(r.stderr, /digest|size mismatch/);
});
test('quota exhaustion does not commit partial cache', async () => {
  const f = await fixture(); const o = path.join(f.dir, 'o'); const r = run(f, o, ['--quotaBytes', '1']);
  assert.equal(r.status, 0, r.stderr); const e = JSON.parse(await readFile(o));
  assert.equal(e.install.committed, false); assert.equal(e.install.partialAuthoritativeEntries, 0);
  assert.deepEqual(e.finalCaches, ['fia-stale-release']);
});
test('stale bundle identity is rejected', async () => {
  const f = await fixture(); const b = JSON.parse(await readFile(f.bp)); b.cacheName = 'fia-changed';
  await writeFile(f.bp, canonical(b)); const r = run(f, path.join(f.dir, 'o'));
  assert.notEqual(r.status, 0); assert.match(r.stderr, /identity mismatch/);
});
test('unsafe artifact path is rejected', async () => {
  const f = await fixture(); const b = JSON.parse(await readFile(f.bp)); b.entries[0].path = '../escape'; b.identity = id(b);
  await writeFile(f.bp, canonical(b)); const r = run(f, path.join(f.dir, 'o'));
  assert.notEqual(r.status, 0); assert.match(r.stderr, /unsafe/);
});
test('retained evidence cannot be overwritten', async () => {
  const f = await fixture(); const o = path.join(f.dir, 'o'); await writeFile(o, 'retained'); const r = run(f, o);
  assert.notEqual(r.status, 0); assert.equal(await readFile(o, 'utf8'), 'retained');
});
