import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { compileDependencyAuthority } from './verify-dependency-authority.mjs';

const pkg = { name: 'app', version: '1.0.0', dependencies: { react: '18.3.1' } };
const dependency = {
  version: '18.3.1',
  resolved: 'https://registry.npmjs.org/react/-/react-18.3.1.tgz',
  integrity: 'sha512-YWJj'
};
const lock = {
  name: 'app',
  version: '1.0.0',
  lockfileVersion: 3,
  packages: { '': { ...pkg }, 'node_modules/react': dependency }
};
const bytes = (value) => Buffer.from(JSON.stringify(value));

test('equivalent records have identical identities', () => {
  assert.equal(
    compileDependencyAuthority(bytes(pkg), bytes(lock)).identity,
    compileDependencyAuthority(bytes(pkg), bytes(lock)).identity
  );
});

test('package and lock declarations must match', () => {
  const bad = structuredClone(lock);
  bad.packages[''].dependencies.react = '^18.0.0';
  assert.throws(() => compileDependencyAuthority(bytes(pkg), bytes(bad)), /declarations differ/);
});

test('missing integrity is rejected', () => {
  const bad = structuredClone(lock);
  delete bad.packages['node_modules/react'].integrity;
  assert.throws(() => compileDependencyAuthority(bytes(pkg), bytes(bad)), /integrity/);
});

test('lifecycle scripts are rejected', () => {
  const bad = structuredClone(lock);
  bad.packages['node_modules/react'].hasInstallScript = true;
  assert.throws(() => compileDependencyAuthority(bytes(pkg), bytes(bad)), /lifecycle-script/);
});

test('credentialed resolved URLs are rejected', () => {
  const bad = structuredClone(lock);
  bad.packages['node_modules/react'].resolved = 'https://token@registry.example/react.tgz';
  assert.throws(() => compileDependencyAuthority(bytes(pkg), bytes(bad)), /credentials/);
});

test('CLI refuses to overwrite retained evidence', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fia-deps-'));
  await writeFile(path.join(dir, 'package.json'), bytes(pkg));
  await writeFile(path.join(dir, 'package-lock.json'), bytes(lock));
  await writeFile(path.join(dir, 'out.json'), 'retained');
  const result = spawnSync(
    process.execPath,
    [
      path.resolve('verify-dependency-authority.mjs'),
      '--package', path.join(dir, 'package.json'),
      '--lockfile', path.join(dir, 'package-lock.json'),
      '--output', path.join(dir, 'out.json')
    ],
    { cwd: path.dirname(new URL(import.meta.url).pathname), encoding: 'utf8' }
  );
  assert.notEqual(result.status, 0);
  assert.equal(await readFile(path.join(dir, 'out.json'), 'utf8'), 'retained');
});
