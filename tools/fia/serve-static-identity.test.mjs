import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStaticRuntime } from './serve-static.mjs';
import { verifyRuntime } from './verify-runtime.mjs';

const ARTIFACT = `sha256:${'a'.repeat(64)}`;

async function fixtureRoot() {
  const dir = await mkdtemp(join(tmpdir(), 'fia-runtime-id-'));
  await writeFile(join(dir, 'index.html'), 'ok');
  return dir;
}

async function withRuntime(options, fn) {
  const runtime = await createStaticRuntime({ ...options, host: '127.0.0.1', port: 0 });
  try { await fn(`http://127.0.0.1:${runtime.address.port}`); }
  finally { await runtime.close(); }
}

test('exposes no-store health and exact artifact identity contracts', async () => {
  await withRuntime({ root: await fixtureRoot(), artifact: ARTIFACT }, async base => {
    const health = await fetch(`${base}/healthz`);
    const identity = await fetch(`${base}/fia-artifact`);
    assert.deepEqual(await health.json(), { schema: 'fia.runtime-health.v1', status: 'ok' });
    assert.deepEqual(await identity.json(), { schema: 'fia.runtime-artifact.v1', artifact: ARTIFACT });
    assert.equal(health.headers.get('cache-control'), 'no-store');
    assert.equal(identity.headers.get('cache-control'), 'no-store');
  });
});

test('owned verifier accepts exact served identity', async () => {
  await withRuntime({ root: await fixtureRoot(), artifact: ARTIFACT }, async base => {
    const evidence = await verifyRuntime({ url: base, artifact: ARTIFACT, timeout: 1000 });
    assert.equal(evidence.artifact, ARTIFACT);
    assert.match(evidence.verification, /^sha256:[a-f0-9]{64}$/);
  });
});

test('owned verifier rejects mismatched expected identity', async () => {
  await withRuntime({ root: await fixtureRoot(), artifact: ARTIFACT }, async base => {
    await assert.rejects(
      () => verifyRuntime({ url: base, artifact: `sha256:${'b'.repeat(64)}`, timeout: 1000 }),
      /served artifact mismatch/,
    );
  });
});

test('runtime fails closed without a valid artifact identity', async () => {
  const root = await fixtureRoot();
  await assert.rejects(() => createStaticRuntime({ root, host: '127.0.0.1', port: 0 }), /artifact identity/);
  await assert.rejects(() => createStaticRuntime({ root, host: '127.0.0.1', port: 0, artifact: 'latest' }), /artifact identity/);
});

test('identity endpoints support HEAD and reject mutation methods', async () => {
  await withRuntime({ root: await fixtureRoot(), artifact: ARTIFACT }, async base => {
    const head = await fetch(`${base}/fia-artifact`, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
    const post = await fetch(`${base}/healthz`, { method: 'POST' });
    assert.equal(post.status, 405);
  });
});
