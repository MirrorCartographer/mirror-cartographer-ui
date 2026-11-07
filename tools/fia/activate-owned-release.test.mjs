import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readlink, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { activate } from './activate-owned-release.mjs';

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function identity(record) {
  const copy = structuredClone(record);
  delete copy.identity;
  return sha256(Buffer.from(canonical(copy)));
}

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'fia-activation-'));
  const bundle = {
    schema: 'fia.static-runtime-bundle.v1',
    files: {
      'index.html': '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width"></head><body><main>ok</main></body></html>',
      'app.js': 'console.log("ok")',
    },
  };
  const bundleBytes = Buffer.from(JSON.stringify(bundle));
  const runtime = path.join(root, 'runtime.json');
  await writeFile(runtime, bundleBytes);
  const imported = {
    schema: 'fia.owned-registry-import.v1',
    runtime: { sha256: sha256(bundleBytes), size: bundleBytes.length },
  };
  imported.identity = identity(imported);
  const importFile = path.join(root, 'import.json');
  await writeFile(importFile, canonical(imported));
  return { root, runtime, importFile };
}

test('activates immutable runtime and emits deterministic evidence', async () => {
  const item = await fixture();
  const evidence = await activate({ importFile: item.importFile, runtimeSource: item.runtime, stateDir: path.join(item.root, 'state'), releaseName: 'preview', output: path.join(item.root, 'evidence.json') });
  assert.equal(evidence.schema, 'fia.owned-release-activation.v1');
  assert.equal(await readlink(path.join(item.root, 'state', 'active')), path.join(item.root, 'state', 'releases', evidence.release.id));
  assert.equal(evidence.identity, identity(evidence));
});

test('equivalent independent activations have identical identity', async () => {
  const left = await fixture();
  const right = await fixture();
  const leftEvidence = await activate({ importFile: left.importFile, runtimeSource: left.runtime, stateDir: path.join(left.root, 'state'), releaseName: 'preview', output: path.join(left.root, 'evidence.json') });
  const rightEvidence = await activate({ importFile: right.importFile, runtimeSource: right.runtime, stateDir: path.join(right.root, 'state'), releaseName: 'preview', output: path.join(right.root, 'evidence.json') });
  assert.equal(leftEvidence.identity, rightEvidence.identity);
});

test('rejects stale registry import identity', async () => {
  const item = await fixture();
  const imported = JSON.parse(await readFile(item.importFile));
  imported.runtime.size += 1;
  await writeFile(item.importFile, canonical(imported));
  await assert.rejects(() => activate({ importFile: item.importFile, runtimeSource: item.runtime, stateDir: path.join(item.root, 'state'), releaseName: 'preview', output: path.join(item.root, 'evidence.json') }), /identity mismatch/);
});

test('rejects runtime substitution', async () => {
  const item = await fixture();
  await writeFile(item.runtime, 'changed');
  await assert.rejects(() => activate({ importFile: item.importFile, runtimeSource: item.runtime, stateDir: path.join(item.root, 'state'), releaseName: 'preview', output: path.join(item.root, 'evidence.json') }), /do not match/);
});

test('rejects autoplay and provider runtime coupling', async () => {
  const item = await fixture();
  const bundle = { schema: 'fia.static-runtime-bundle.v1', files: { 'index.html': '<html lang="en"><head><meta name="viewport" content="width=device-width"></head><body><audio autoplay src="https://x.vercel.app/a"></audio></body></html>' } };
  const bundleBytes = Buffer.from(JSON.stringify(bundle));
  await writeFile(item.runtime, bundleBytes);
  const imported = { schema: 'fia.owned-registry-import.v1', runtime: { sha256: sha256(bundleBytes), size: bundleBytes.length } };
  imported.identity = identity(imported);
  await writeFile(item.importFile, canonical(imported));
  await assert.rejects(() => activate({ importFile: item.importFile, runtimeSource: item.runtime, stateDir: path.join(item.root, 'state'), releaseName: 'preview', output: path.join(item.root, 'evidence.json') }), /static check failed/);
});

test('rolls back active pointer after post-switch failure', async () => {
  const item = await fixture();
  const state = path.join(item.root, 'state');
  const oldRelease = path.join(state, 'releases', 'old');
  await mkdir(oldRelease, { recursive: true });
  await symlink(oldRelease, path.join(state, 'active'), 'dir');
  await assert.rejects(() => activate({ importFile: item.importFile, runtimeSource: item.runtime, stateDir: state, releaseName: 'preview', output: path.join(item.root, 'evidence.json'), injectPostSwitchFailure: true }), /injected/);
  assert.equal(await readlink(path.join(state, 'active')), oldRelease);
});

test('refuses immutable release overwrite', async () => {
  const item = await fixture();
  const state = path.join(item.root, 'state');
  await activate({ importFile: item.importFile, runtimeSource: item.runtime, stateDir: state, releaseName: 'preview', output: path.join(item.root, 'first.json') });
  await assert.rejects(() => activate({ importFile: item.importFile, runtimeSource: item.runtime, stateDir: state, releaseName: 'preview', output: path.join(item.root, 'second.json') }), /already exists/);
});

test('refuses evidence overwrite', async () => {
  const item = await fixture();
  const output = path.join(item.root, 'evidence.json');
  await writeFile(output, 'keep');
  await assert.rejects(() => activate({ importFile: item.importFile, runtimeSource: item.runtime, stateDir: path.join(item.root, 'state'), releaseName: 'preview', output }), /EEXIST/);
  assert.equal(await readFile(output, 'utf8'), 'keep');
});
