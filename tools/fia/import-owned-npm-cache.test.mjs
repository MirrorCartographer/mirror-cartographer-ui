import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { importOwnedCache } from './import-owned-npm-cache.mjs';

const sri = (bytes) => `sha512-${createHash('sha512').update(bytes).digest('base64')}`;

async function fixture({ tamper = false, surplus = false, conflict = false } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'fia-cache-'));
  const packageBytes = Buffer.from('owned package bytes');
  await mkdir(path.join(root, 'tarballs'));
  await writeFile(
    path.join(root, 'tarballs', 'a.tgz'),
    tamper ? Buffer.from('changed') : packageBytes,
  );

  const integrity = sri(packageBytes);
  const packages = {
    '': { name: 'x', version: '1.0.0', dependencies: { a: '1.0.0' } },
    'node_modules/a': {
      name: 'a',
      version: '1.0.0',
      resolved: 'https://registry.example/a.tgz',
      integrity,
    },
  };
  if (conflict) {
    packages['node_modules/b/node_modules/a'] = {
      name: 'a',
      version: '1.0.0',
      resolved: 'https://mirror.example/a.tgz',
      integrity,
    };
  }

  await writeFile(
    path.join(root, 'package-lock.json'),
    JSON.stringify({ name: 'x', version: '1.0.0', lockfileVersion: 3, packages }),
  );

  const plan = {
    schema: 'fia.owned-npm-cache-import-plan.v1',
    packages: [{ integrity, file: 'tarballs/a.tgz' }],
  };
  if (surplus) {
    plan.packages.push({ integrity: sri(Buffer.from('surplus')), file: 'tarballs/a.tgz' });
  }
  await writeFile(path.join(root, 'plan.json'), JSON.stringify(plan));

  return {
    root,
    options: {
      lockfile: path.join(root, 'package-lock.json'),
      plan: path.join(root, 'plan.json'),
      outputDir: path.join(root, 'cache'),
      manifest: path.join(root, 'manifest.json'),
    },
  };
}

test('equivalent imports produce the same identity and object path', async () => {
  const first = await fixture();
  const second = await fixture();
  const firstRecord = await importOwnedCache(first.options);
  const secondRecord = await importOwnedCache(second.options);

  assert.equal(firstRecord.identity, secondRecord.identity);
  assert.equal(firstRecord.objects[0].path, secondRecord.objects[0].path);
  assert.deepEqual(
    await readFile(path.join(first.options.outputDir, firstRecord.objects[0].path)),
    Buffer.from('owned package bytes'),
  );
});

test('tampered tarball is rejected', async () => {
  const testFixture = await fixture({ tamper: true });
  await assert.rejects(importOwnedCache(testFixture.options), /integrity mismatch/);
});

test('surplus mapping is rejected', async () => {
  const testFixture = await fixture({ surplus: true });
  await assert.rejects(importOwnedCache(testFixture.options), /surplus tarball mapping/);
});

test('conflicting provenance for same integrity is rejected', async () => {
  const testFixture = await fixture({ conflict: true });
  await assert.rejects(importOwnedCache(testFixture.options), /conflicting resolved URLs/);
});

test('retained destinations cannot be overwritten', async () => {
  const testFixture = await fixture();
  await importOwnedCache(testFixture.options);
  await assert.rejects(importOwnedCache(testFixture.options), /destination already exists/);
});
