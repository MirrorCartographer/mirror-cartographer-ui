import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { deploy, rollback } from './deploy-release.mjs';

function sha(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'fia-deploy-test-'));
  const store = join(root, 'store');
  mkdirSync(join(store, 'releases'), { recursive: true });
  function add(content) {
    const bytes = Buffer.from(content);
    const fileDigest = sha(bytes);
    const aggregate = createHash('sha256').update(`index.html\0${fileDigest}\0${bytes.length}\n`).digest('hex');
    const blobDir = join(store, 'blobs', 'sha256', fileDigest.slice(0, 2));
    mkdirSync(blobDir, { recursive: true });
    writeFileSync(join(blobDir, fileDigest), bytes);
    writeFileSync(join(store, 'releases', `${aggregate}.json`), JSON.stringify({
      schema: 'foundation-intelligence-release/v1', artifact: `sha256:${aggregate}`, files: [{ path: 'index.html', bytes: bytes.length, sha256: fileDigest }]
    }));
    return `sha256:${aggregate}`;
  }
  return { root, store, deployRoot: join(root, 'deploy'), add, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

function currentTarget(deployRoot) { return resolve(deployRoot, readlinkSync(join(deployRoot, 'current'))); }

test('deploy promotes verified release atomically and records identity', () => {
  const f = fixture();
  try {
    const artifact = f.add('<h1>A</h1>');
    const result = deploy({ artifact, store: f.store, root: f.deployRoot, healthCommand: "if (!require('fs').existsSync('index.html')) process.exit(1)" });
    assert.equal(result.state, 'promoted');
    assert.match(result.deployment, /^sha256:[a-f0-9]{64}$/);
    assert.equal(readFileSync(join(currentTarget(f.deployRoot), 'index.html'), 'utf8'), '<h1>A</h1>');
  } finally { f.cleanup(); }
});

test('failed health check leaves previous release current and removes staging', () => {
  const f = fixture();
  try {
    const a = f.add('A'); const b = f.add('B');
    deploy({ artifact: a, store: f.store, root: f.deployRoot });
    assert.throws(() => deploy({ artifact: b, store: f.store, root: f.deployRoot, healthCommand: 'process.exit(9)' }));
    assert.equal(readFileSync(join(currentTarget(f.deployRoot), 'index.html'), 'utf8'), 'A');
  } finally { f.cleanup(); }
});

test('rollback switches to an explicitly retained release', () => {
  const f = fixture();
  try {
    const a = f.add('A'); const b = f.add('B');
    deploy({ artifact: a, store: f.store, root: f.deployRoot });
    deploy({ artifact: b, store: f.store, root: f.deployRoot });
    const result = rollback({ root: f.deployRoot, artifact: a });
    assert.equal(result.state, 'rolled-back');
    assert.equal(readFileSync(join(currentTarget(f.deployRoot), 'index.html'), 'utf8'), 'A');
  } finally { f.cleanup(); }
});

test('corrupt blob fails before promotion', () => {
  const f = fixture();
  try {
    const a = f.add('A');
    const descriptor = JSON.parse(readFileSync(join(f.store, 'releases', `${a.slice(7)}.json`), 'utf8'));
    writeFileSync(join(f.store, 'blobs', 'sha256', descriptor.files[0].sha256.slice(0, 2), descriptor.files[0].sha256), 'tampered');
    assert.throws(() => deploy({ artifact: a, store: f.store, root: f.deployRoot }), /Stored blob verification failed/);
  } finally { f.cleanup(); }
});

test('escaping current symlink is rejected', () => {
  const f = fixture();
  try {
    mkdirSync(f.deployRoot, { recursive: true });
    symlinkSync('../../outside', join(f.deployRoot, 'current'));
    const a = f.add('A');
    assert.throws(() => deploy({ artifact: a, store: f.store, root: f.deployRoot }), /escapes releases root/);
  } finally { f.cleanup(); }
});
