import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createOwnedRuntimeServer, resolveActiveRuntime, SCHEMA } from './serve-owned-runtime.mjs';

function fixture() {
  const stateDir = mkdtempSync(join(tmpdir(), 'fia-runtime-'));
  const release = join(stateDir, 'releases', 'preview-abc');
  mkdirSync(join(release, 'assets'), { recursive: true });
  writeFileSync(join(release, 'index.html'), '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><body>owned</body></html>');
  writeFileSync(join(release, 'assets', 'app.js'), 'console.log("owned")');
  symlinkSync('releases/preview-abc', join(stateDir, 'active'));
  return { stateDir, release };
}

async function running(stateDir) {
  const { server } = createOwnedRuntimeServer({ stateDir });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return { server, url: `http://127.0.0.1:${port}` };
}

test('serves exact bytes with digest and security headers', async (t) => {
  const { stateDir } = fixture();
  const { server, url } = await running(stateDir); t.after(() => server.close());
  const response = await fetch(`${url}/assets/app.js`);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'console.log("owned")');
  assert.match(response.headers.get('x-fia-content-sha256'), /^[a-f0-9]{64}$/);
  assert.equal(response.headers.get('x-fia-schema'), SCHEMA);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('SPA fallback only applies to extensionless HTML navigation', async (t) => {
  const { stateDir } = fixture(); const { server, url } = await running(stateDir); t.after(() => server.close());
  const route = await fetch(`${url}/map/room`, { headers: { accept: 'text/html' } });
  assert.equal(route.status, 200); assert.equal(route.headers.get('x-fia-spa-fallback'), '1');
  const asset = await fetch(`${url}/missing.js`, { headers: { accept: 'text/html' } });
  assert.equal(asset.status, 404);
});

test('rejects traversal and encoded traversal', async (t) => {
  const { stateDir } = fixture(); const { server, url } = await running(stateDir); t.after(() => server.close());
  for (const path of ['/%2e%2e/package.json', '/..%2fpackage.json', '/%5c..%5csecret']) {
    const response = await fetch(`${url}${path}`); assert.notEqual(response.status, 200);
  }
});

test('rejects symlinks inside the active runtime', async (t) => {
  const { stateDir, release } = fixture(); symlinkSync('/etc/hosts', join(release, 'escape.txt'));
  const { server, url } = await running(stateDir); t.after(() => server.close());
  const response = await fetch(`${url}/escape.txt`); assert.equal(response.status, 500);
});

test('rejects active pointers outside releases', () => {
  const stateDir = mkdtempSync(join(tmpdir(), 'fia-runtime-')); mkdirSync(join(stateDir, 'releases')); symlinkSync('/tmp', join(stateDir, 'active'));
  assert.throws(() => resolveActiveRuntime(stateDir), /escapes releases directory/);
});

test('HEAD returns headers without body and unsupported methods fail', async (t) => {
  const { stateDir } = fixture(); const { server, url } = await running(stateDir); t.after(() => server.close());
  const head = await fetch(`${url}/`, { method: 'HEAD' }); assert.equal(head.status, 200); assert.equal(await head.text(), '');
  const post = await fetch(`${url}/`, { method: 'POST' }); assert.equal(post.status, 405); assert.equal(post.headers.get('allow'), 'GET, HEAD');
});
