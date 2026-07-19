import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const tool = path.join(path.dirname(fileURLToPath(import.meta.url)), 'compile-owned-deployment-bundle.mjs');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const canonical = value => Array.isArray(value)
  ? `[${value.map(canonical).join(',')}]`
  : value && typeof value === 'object'
    ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
    : JSON.stringify(value);
const identity = value => sha256(Buffer.from(canonical(value)));
function evidence(schema, releaseIdentity, extra = {}) {
  const material = { schema, releaseIdentity, ...extra };
  return { ...material, identity: identity(material) };
}
async function fixture(releaseIdentity = 'release-a') {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'fia-deployment-'));
  const root = path.join(directory, 'dist');
  await mkdir(path.join(root, 'assets'), { recursive: true });
  const index = Buffer.from('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><body>owned</body></html>');
  const script = Buffer.from('console.log("owned")\n');
  await writeFile(path.join(root, 'index.html'), index);
  await writeFile(path.join(root, 'assets/app.js'), script);
  const routes = evidence('fia.runtime-route-manifest.v1', releaseIdentity, { files: 2 });
  const offline = evidence('fia.offline-runtime-bundle.v1', releaseIdentity, { cache: 'cache-a' });
  await writeFile(path.join(directory, 'routes.json'), canonical(routes));
  await writeFile(path.join(directory, 'offline.json'), canonical(offline));
  const request = {
    schema: 'fia.owned-deployment-bundle-request.v1',
    releaseName: 'preview',
    evidence: [
      { role: 'routes', path: 'routes.json', schema: routes.schema, releaseIdentityPointer: '/releaseIdentity' },
      { role: 'offline', path: 'offline.json', schema: offline.schema, releaseIdentityPointer: '/releaseIdentity' },
    ],
    runtimeFiles: [
      { path: 'index.html', size: index.length, sha256: sha256(index) },
      { path: 'assets/app.js', size: script.length, sha256: sha256(script) },
    ],
  };
  await writeFile(path.join(directory, 'request.json'), JSON.stringify(request, null, 2));
  return { directory, root };
}
function run(fixture, suffix = '') {
  return spawnSync(process.execPath, [
    tool,
    '--request', path.join(fixture.directory, 'request.json'),
    '--root', fixture.root,
    '--bundleDir', path.join(fixture.directory, `bundle${suffix}`),
    '--archive', path.join(fixture.directory, `bundle${suffix}.tar`),
    '--output', path.join(fixture.directory, `evidence${suffix}.json`),
  ], { encoding: 'utf8' });
}

test('equivalent independent bundles are byte reproducible', async () => {
  const first = await fixture();
  const second = await fixture();
  assert.equal(run(first).status, 0);
  assert.equal(run(second).status, 0);
  assert.deepEqual(await readFile(path.join(first.directory, 'bundle.tar')), await readFile(path.join(second.directory, 'bundle.tar')));
  const firstEvidence = JSON.parse(await readFile(path.join(first.directory, 'evidence.json')));
  const secondEvidence = JSON.parse(await readFile(path.join(second.directory, 'evidence.json')));
  assert.equal(firstEvidence.identity, secondEvidence.identity);
  assert.equal(firstEvidence.archive.sha256, secondEvidence.archive.sha256);
});

test('cross-release evidence mismatch fails closed', async () => {
  const subject = await fixture();
  const incompatible = evidence('fia.offline-runtime-bundle.v1', 'release-b', { cache: 'cache-b' });
  await writeFile(path.join(subject.directory, 'offline.json'), canonical(incompatible));
  const result = run(subject);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /cross-release evidence mismatch/);
});

test('runtime substitution is rejected', async () => {
  const subject = await fixture();
  await writeFile(path.join(subject.root, 'index.html'), 'changed');
  const result = run(subject);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /runtime (size|digest) mismatch/);
});

test('stale logical evidence identity is rejected', async () => {
  const subject = await fixture();
  const routes = JSON.parse(await readFile(path.join(subject.directory, 'routes.json')));
  routes.files = 99;
  await writeFile(path.join(subject.directory, 'routes.json'), JSON.stringify(routes));
  const result = run(subject);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /identity mismatch/);
});

test('symlink runtime artifacts are rejected', async () => {
  const subject = await fixture();
  await symlink('/etc/hosts', path.join(subject.root, 'escape.txt'));
  const requestPath = path.join(subject.directory, 'request.json');
  const request = JSON.parse(await readFile(requestPath));
  const bytes = await readFile('/etc/hosts');
  request.runtimeFiles.push({ path: 'escape.txt', size: bytes.length, sha256: sha256(bytes) });
  await writeFile(requestPath, JSON.stringify(request));
  const result = run(subject);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /symbolic link rejected/);
});

test('retained outputs cannot be overwritten', async () => {
  const subject = await fixture();
  assert.equal(run(subject).status, 0);
  const before = await readFile(path.join(subject.directory, 'evidence.json'));
  const result = run(subject);
  assert.notEqual(result.status, 0);
  assert.deepEqual(await readFile(path.join(subject.directory, 'evidence.json')), before);
});

test('archive contains runtime, evidence, manifest, install, and rollback closure', async () => {
  const subject = await fixture();
  assert.equal(run(subject).status, 0);
  const archive = await readFile(path.join(subject.directory, 'bundle.tar'));
  for (const entry of [
    'commands/install.sh', 'commands/rollback.sh', 'deployment-manifest.json',
    'evidence/routes.json', 'evidence/offline.json', 'runtime/index.html', 'runtime/assets/app.js',
  ]) assert.equal(archive.includes(Buffer.from(entry)), true, entry);
});
