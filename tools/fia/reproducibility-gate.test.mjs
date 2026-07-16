import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { assertImmutableLockfile, compareInventories, inventoryDirectory, runReproducibilityGate } from './reproducibility-gate.mjs';

async function fixture(builderSource, withLock = true) {
  const root = await mkdtemp(path.join(tmpdir(), 'fia-repro-test-'));
  if (withLock) await writeFile(path.join(root, 'package-lock.json'), '{"lockfileVersion":3}\n');
  await writeFile(path.join(root, 'builder.mjs'), builderSource);
  return root;
}

const deterministicBuilder = `
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('dist/assets', { recursive: true });
await writeFile('dist/index.html', '<!doctype html><title>Foundation</title>\\n');
await writeFile('dist/assets/app.js', 'console.log("stable")\\n');
`;

const nondeterministicBuilder = `
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
await writeFile('dist/index.html', 'build=' + process.env.FIA_REPRO_BUILD_INDEX + '\\n');
`;

test('identical clean builds produce one stable aggregate and attestation', async () => {
  const root = await fixture(deterministicBuilder);
  const attestation = path.join(root, 'evidence', 'repro.json');
  try {
    const first = await runReproducibilityGate({ sourceRoot: root, command: 'node builder.mjs', attestation });
    assert.equal(first.reproducible, true);
    assert.equal(first.buildA.aggregateSha256, first.buildB.aggregateSha256);
    const persisted = JSON.parse(await readFile(attestation, 'utf8'));
    assert.equal(persisted.schema, 'fia.reproducibility-attestation.v1');
    assert.equal(persisted.reproducible, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('build-specific output is detected and rejected', async () => {
  const root = await fixture(nondeterministicBuilder);
  try {
    await assert.rejects(
      runReproducibilityGate({ sourceRoot: root, command: 'node builder.mjs' }),
      (error) => {
        assert.match(error.message, /not reproducible/);
        assert.equal(error.result.differences[0].path, 'index.html');
        assert.equal(error.result.differences[0].kind, 'content-mismatch');
        return true;
      },
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('missing immutable lockfile fails before any build command runs', async () => {
  const root = await fixture(deterministicBuilder, false);
  try {
    await assert.rejects(
      runReproducibilityGate({ sourceRoot: root, command: 'node builder.mjs' }),
      /Immutable dependency lockfile required but missing/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('stale or extra output paths are differences', () => {
  const first = { files: [{ path: 'index.html', size: 1, sha256: 'a' }] };
  const second = { files: [
    { path: 'index.html', size: 1, sha256: 'a' },
    { path: 'stale.js', size: 1, sha256: 'b' },
  ] };
  assert.deepEqual(compareInventories(first, second), [{ path: 'stale.js', kind: 'only-in-build-b' }]);
});

test('inventory rejects symbolic links in build output', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'fia-repro-symlink-'));
  try {
    await mkdir(path.join(root, 'dist'));
    await writeFile(path.join(root, 'target.txt'), 'secret');
    const { symlink } = await import('node:fs/promises');
    await symlink(path.join(root, 'target.txt'), path.join(root, 'dist', 'leak.txt'));
    await assert.rejects(inventoryDirectory(path.join(root, 'dist')), /Unsupported output entry/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('lockfile identity is content-addressed', async () => {
  const root = await fixture(deterministicBuilder);
  try {
    const lock = await assertImmutableLockfile(root);
    assert.equal(lock.path, 'package-lock.json');
    assert.match(lock.sha256, /^[a-f0-9]{64}$/);
    assert.equal(lock.size, 22);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
