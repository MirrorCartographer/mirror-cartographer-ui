import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { checkout, ingest } from './artifact-store.mjs';

const hash = (body) => createHash('sha256').update(body).digest('hex');

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'fia-store-'));
  const dist = join(root, 'dist');
  mkdirSync(join(dist, 'assets'), { recursive: true });
  const map = {
    'index.html': '<h1>owned</h1>',
    'assets/app.js': 'console.log("fia")\n',
  };
  for (const [path, body] of Object.entries(map)) {
    mkdirSync(join(dist, path, '..'), { recursive: true });
    writeFileSync(join(dist, path), body);
  }
  const files = Object.entries(map)
    .map(([path, body]) => ({ path, bytes: Buffer.byteLength(body), sha256: hash(body) }))
    .sort((a, b) => a.path.localeCompare(b.path));
  const aggregate = createHash('sha256');
  for (const file of files) aggregate.update(`${file.path}\0${file.sha256}\0${file.bytes}\n`);
  const manifest = {
    schema: 'foundation-intelligence-artifact/v1',
    application: 'mirror-cartographer-ui',
    commit: 'abc',
    entrypoint: 'index.html',
    aggregateSha256: aggregate.digest('hex'),
    files,
  };
  const manifestPath = join(root, 'manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest));
  return { root, dist, store: join(root, 'store'), manifestPath, manifest, map };
}

test('ingest is content-addressed and idempotent', () => {
  const f = fixture();
  const first = ingest({ dist: f.dist, manifestPath: f.manifestPath, store: f.store });
  const second = ingest({ dist: f.dist, manifestPath: f.manifestPath, store: f.store });
  assert.deepEqual(first, second);
  assert.equal(first.artifact, `sha256:${f.manifest.aggregateSha256}`);
});

test('checkout reconstructs exact rollback bytes', () => {
  const f = fixture();
  const ingested = ingest({ dist: f.dist, manifestPath: f.manifestPath, store: f.store });
  const output = join(f.root, 'rollback');
  checkout({ artifact: ingested.artifact, store: f.store, destination: output });
  for (const [path, body] of Object.entries(f.map)) assert.equal(readFileSync(join(output, path), 'utf8'), body);
});

test('tampered build is rejected before storage', () => {
  const f = fixture();
  writeFileSync(join(f.dist, 'index.html'), 'tampered');
  assert.throws(() => ingest({ dist: f.dist, manifestPath: f.manifestPath, store: f.store }), /Digest mismatch/);
});

test('corrupt stored blob blocks rollback', () => {
  const f = fixture();
  const ingested = ingest({ dist: f.dist, manifestPath: f.manifestPath, store: f.store });
  const digest = f.manifest.files[0].sha256;
  writeFileSync(join(f.store, 'blobs', 'sha256', digest.slice(0, 2), digest), 'corrupt');
  assert.throws(
    () => checkout({ artifact: ingested.artifact, store: f.store, destination: join(f.root, 'bad') }),
    /Stored blob verification failed/,
  );
});

test('path traversal is rejected', () => {
  const f = fixture();
  f.manifest.files[0].path = '../escape';
  writeFileSync(f.manifestPath, JSON.stringify(f.manifest));
  assert.throws(() => ingest({ dist: f.dist, manifestPath: f.manifestPath, store: f.store }), /Unsafe artifact path/);
});
