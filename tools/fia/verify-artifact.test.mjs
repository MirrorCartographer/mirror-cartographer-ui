import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { verifyArtifact } from './verify-artifact.mjs';

const digest = (value) => createHash('sha256').update(value).digest('hex');

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'fia-artifact-'));
  const artifactDir = path.join(root, 'artifact');
  await fs.mkdir(path.join(artifactDir, 'assets'), { recursive: true });
  await fs.writeFile(path.join(artifactDir, 'index.html'), '<main>owned</main>\n');
  await fs.writeFile(path.join(artifactDir, 'assets', 'app.js'), 'console.log("fia")\n');
  const files = [
    ['assets/app.js', 'console.log("fia")\n'],
    ['index.html', '<main>owned</main>\n'],
  ].map(([file, body]) => ({ path: file, size: Buffer.byteLength(body), sha256: digest(body) }));
  const manifestPath = path.join(root, 'manifest.json');
  await fs.writeFile(manifestPath, JSON.stringify({ schema: 'fia.artifact-manifest.v1', files }));
  return { root, artifactDir, manifestPath };
}

test('accepts an exact untampered artifact and returns stable aggregate identity', async () => {
  const f = await fixture();
  const a = await verifyArtifact(f);
  const b = await verifyArtifact(f);
  assert.equal(a.ok, true);
  assert.equal(a.files, 2);
  assert.equal(a.aggregate, b.aggregate);
});

test('rejects content tampering even when path is unchanged', async () => {
  const f = await fixture();
  await fs.writeFile(path.join(f.artifactDir, 'index.html'), '<main>tampered</main>\n');
  await assert.rejects(() => verifyArtifact(f), /size mismatch|sha256 mismatch/);
});

test('rejects unmanifested stale files by default', async () => {
  const f = await fixture();
  await fs.writeFile(path.join(f.artifactDir, 'stale.txt'), 'stale');
  await assert.rejects(() => verifyArtifact(f), /unmanifested files present/);
});

test('rejects traversal paths before reading outside artifact root', async () => {
  const f = await fixture();
  const manifest = JSON.parse(await fs.readFile(f.manifestPath, 'utf8'));
  manifest.files[0].path = '../secret';
  await fs.writeFile(f.manifestPath, JSON.stringify(manifest));
  await assert.rejects(() => verifyArtifact(f), /path traversal rejected/);
});
