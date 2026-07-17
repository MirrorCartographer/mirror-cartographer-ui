import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStaticRuntime } from './serve-static.mjs';

const ARTIFACT = `sha256:${'0'.repeat(64)}`;

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'fia-static-runtime-'));
  await mkdir(join(root, 'assets'));
  await writeFile(join(root, 'index.html'), '<!doctype html><title>FIA</title>');
  await writeFile(join(root, 'plain.txt'), 'owned runtime\n');
  await writeFile(join(root, 'assets', 'app.0123456789abcdef.js'), 'console.log("fia")\n');
  return root;
}

async function withRuntime(options, fn) {
  const runtime = await createStaticRuntime({ artifact: ARTIFACT, ...options, host: '127.0.0.1', port: 0 });
  const { port } = runtime.address;
  try { await fn(`http://127.0.0.1:${port}`); }
  finally { await runtime.close(); }
}

test('serves files with privacy and security headers', async () => {
  const root = await fixture();
  await withRuntime({ root }, async base => {
    const response = await fetch(`${base}/plain.txt`);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'owned runtime\n');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(response.headers.get('permissions-policy')?.includes('microphone=()'), true);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('cache-control'), 'public, max-age=3600');
  });
});

test('uses immutable caching only for content-hashed assets', async () => {
  const root = await fixture();
  await withRuntime({ root }, async base => {
    const hashed = await fetch(`${base}/assets/app.0123456789abcdef.js`);
    const html = await fetch(`${base}/`);
    assert.equal(hashed.headers.get('cache-control'), 'public, max-age=31536000, immutable');
    assert.equal(html.headers.get('cache-control'), 'no-cache');
  });
});

test('HEAD returns metadata without a body and rejects mutation methods', async () => {
  const root = await fixture();
  await withRuntime({ root }, async base => {
    const head = await fetch(`${base}/plain.txt`, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(head.headers.get('content-length'), String(Buffer.byteLength('owned runtime\n')));
    assert.equal(await head.text(), '');
    const post = await fetch(`${base}/plain.txt`, { method: 'POST' });
    assert.equal(post.status, 405);
    assert.equal(post.headers.get('allow'), 'GET, HEAD');
  });
});

test('rejects encoded path traversal and malformed encoding', async () => {
  const root = await fixture();
  await withRuntime({ root }, async base => {
    const traversal = await fetch(`${base}/%2e%2e/%2e%2e/etc/passwd`);
    assert.notEqual(traversal.status, 200);
    const malformed = await fetch(`${base}/%E0%A4%A`);
    assert.equal(malformed.status, 400);
  });
});

test('does not follow symlinks outside the static root', async () => {
  const root = await fixture();
  const outside = await mkdtemp(join(tmpdir(), 'fia-outside-'));
  await writeFile(join(outside, 'secret.txt'), 'secret');
  await symlink(join(outside, 'secret.txt'), join(root, 'leak.txt'));
  await withRuntime({ root }, async base => {
    const response = await fetch(`${base}/leak.txt`);
    assert.equal(response.status, 403);
  });
});

test('SPA fallback is explicit and disabled by default', async () => {
  const root = await fixture();
  await withRuntime({ root }, async base => { assert.equal((await fetch(`${base}/route/unknown`)).status, 404); });
  await withRuntime({ root, spa: true }, async base => {
    const response = await fetch(`${base}/route/unknown`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /<title>FIA<\/title>/);
  });
});
