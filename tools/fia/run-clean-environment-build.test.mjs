import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCleanEnvironmentBuild } from './run-clean-environment-build.mjs';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}
const stable = (value) => JSON.stringify(canonical(value));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'fia-clean-build-test-')); const source = path.join(root, 'source');
  await mkdir(source, { recursive: true });
  await writeFile(path.join(source, 'package.json'), '{"name":"fixture","version":"1.0.0"}\n');
  await writeFile(path.join(source, 'src.txt'), 'source\n');
  const lockBytes = Buffer.from('{"name":"fixture","version":"1.0.0","lockfileVersion":3,"packages":{"":{"name":"fixture","version":"1.0.0"}}}\n');
  const lockfile = path.join(source, 'package-lock.json'); await writeFile(lockfile, lockBytes);
  const dependencyInventory = [
    { path: 'pkg/', type: 'directory', mode: 0o755 },
    { path: 'pkg/index.js', type: 'file', mode: 0o644, bytes: 7, sha256: sha256(Buffer.from('stable\n')) },
  ];
  const dep = {
    schema: 'fia.offline-dependency-reproducibility.v1', policy: {}, lockfile: { sha256: sha256(lockBytes), bytes: lockBytes.length },
    cacheManifest: { identity: 'a'.repeat(64), bytesSha256: 'b'.repeat(64), bytes: 1 }, cacheObjects: 1,
    dependencyInventoryIdentity: sha256(Buffer.from(stable(dependencyInventory))), dependencyInventory,
    attempts: [{ attempt: 1, inventoryIdentity: sha256(Buffer.from(stable(dependencyInventory))), stdout: { bytes: 0, sha256: sha256(Buffer.alloc(0)) }, stderr: { bytes: 0, sha256: sha256(Buffer.alloc(0)) } }],
  };
  dep.identity = sha256(Buffer.from(stable(dep)));
  const dependencyEvidence = path.join(root, 'dependency.json'); await writeFile(dependencyEvidence, `${JSON.stringify(dep, null, 2)}\n`);
  const installer = path.join(root, 'install.mjs');
  await writeFile(installer, `#!/usr/bin/env node\nimport {mkdir,writeFile} from 'node:fs/promises';import path from 'node:path';const d=path.join(process.cwd(),'node_modules','pkg');await mkdir(d,{recursive:true});await writeFile(path.join(d,'index.js'),'stable\\n');`);
  await chmod(installer, 0o755);
  const builder = path.join(root, 'build.mjs');
  await writeFile(builder, `#!/usr/bin/env node\nimport {mkdir,writeFile} from 'node:fs/promises';import path from 'node:path';const dist=path.join(process.cwd(),'dist');await mkdir(dist,{recursive:true});const diverge=process.env.FIA_TEST_DIVERGE==='1'&&process.cwd().endsWith('workspace-2');await writeFile(path.join(dist,'index.html'),diverge?'different\\n':'stable output\\n');if(process.env.FIA_TEST_MUTATE==='1')await writeFile(path.join(process.cwd(),'node_modules','pkg','index.js'),'mutated\\n');`);
  await chmod(builder, 0o755);
  return { root, source, lockfile, dependencyEvidence, installer, builder };
}
async function runFixture(f, name = 'attestation.json', extra = {}) {
  return runCleanEnvironmentBuild({ source: f.source, lockfile: f.lockfile, dependencyEvidence: f.dependencyEvidence, installCommand: [f.installer], buildCommand: [f.builder], outputDir: 'dist', attestation: path.join(f.root, name), attempts: 2, ...extra });
}

test('independent clean builds produce identical evidence', async () => {
  const a = await fixture(); const b = await fixture();
  try { const first = await runFixture(a); const second = await runFixture(b); assert.equal(first.identity, second.identity); assert.equal(first.attempts.length, 2); }
  finally { await rm(a.root, { recursive: true, force: true }); await rm(b.root, { recursive: true, force: true }); }
});

test('build-time dependency mutation is rejected', async () => {
  const f = await fixture(); const prior = process.env.FIA_TEST_MUTATE; process.env.FIA_TEST_MUTATE = '1';
  try { await assert.rejects(() => runFixture(f), /build mutated dependency tree/); }
  finally { if (prior === undefined) delete process.env.FIA_TEST_MUTATE; else process.env.FIA_TEST_MUTATE = prior; await rm(f.root, { recursive: true, force: true }); }
});

test('cross-attempt artifact divergence is rejected', async () => {
  const f = await fixture(); const prior = process.env.FIA_TEST_DIVERGE; process.env.FIA_TEST_DIVERGE = '1';
  try { await assert.rejects(() => runFixture(f), /build artifact diverged at attempt 2/); }
  finally { if (prior === undefined) delete process.env.FIA_TEST_DIVERGE; else process.env.FIA_TEST_DIVERGE = prior; await rm(f.root, { recursive: true, force: true }); }
});

test('dependency evidence bound to another lockfile is rejected', async () => {
  const f = await fixture();
  try { await writeFile(f.lockfile, '{"lockfileVersion":3,"packages":{}}\n'); await assert.rejects(() => runFixture(f), /does not bind the supplied lockfile/); }
  finally { await rm(f.root, { recursive: true, force: true }); }
});

test('stale build output in source is excluded and cannot contaminate result', async () => {
  const f = await fixture();
  try { await mkdir(path.join(f.source, 'dist')); await writeFile(path.join(f.source, 'dist', 'stale.txt'), 'stale'); const result = await runFixture(f); assert.equal(result.artifact.some((entry) => entry.path === 'stale.txt'), false); }
  finally { await rm(f.root, { recursive: true, force: true }); }
});

test('retained attestation cannot be overwritten', async () => {
  const f = await fixture();
  try { await runFixture(f); await assert.rejects(() => runFixture(f), /destination already exists/); }
  finally { await rm(f.root, { recursive: true, force: true }); }
});
