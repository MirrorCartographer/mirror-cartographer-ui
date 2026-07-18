import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { verifyOfflineDependencyReproducibility } from './verify-offline-dependency-reproducibility.mjs';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}
const stable = (value) => JSON.stringify(canonical(value));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'fia-offline-test-'));
  const source = path.join(root, 'source');
  const cacheDir = path.join(root, 'cache');
  await mkdir(source, { recursive: true });
  await mkdir(path.join(cacheDir, 'objects', 'sha256'), { recursive: true });
  await writeFile(path.join(source, 'package.json'), '{"name":"fixture","version":"1.0.0"}\n');
  const lockBytes = Buffer.from('{"name":"fixture","version":"1.0.0","lockfileVersion":3,"packages":{"":{"name":"fixture","version":"1.0.0"}}}\n');
  const lockfile = path.join(source, 'package-lock.json');
  await writeFile(lockfile, lockBytes);
  const tarball = Buffer.from('owned package bytes');
  const digest = sha256(tarball);
  const objectPath = `objects/sha256/${digest}.tgz`;
  await writeFile(path.join(cacheDir, objectPath), tarball);
  const manifest = {
    schema: 'fia.owned-npm-cache.v1',
    policy: { addressing: 'sha256' },
    lockfile: { sha256: sha256(lockBytes), bytes: lockBytes.length, lockfileVersion: 3 },
    importPlan: { sha256: '0'.repeat(64), bytes: 1 },
    packages: [{ integrity: 'sha512-fixture', resolved: 'https://registry.invalid/pkg.tgz', paths: ['node_modules/pkg'], sha256: digest, bytes: tarball.length, object: objectPath }],
    objects: [{ sha256: digest, bytes: tarball.length, path: objectPath }],
  };
  manifest.identity = sha256(Buffer.from(stable(manifest)));
  const cacheManifest = path.join(cacheDir, 'cache-manifest.json');
  await writeFile(cacheManifest, `${JSON.stringify(manifest, null, 2)}\n`);
  const npm = path.join(root, 'fake-npm.mjs');
  await writeFile(npm, `#!/usr/bin/env node\nimport { mkdir, writeFile } from 'node:fs/promises';\nimport path from 'node:path';\nconst args=process.argv.slice(2);\nif(args[0]==='cache'&&args[1]==='add') process.exit(0);\nif(args[0]!=='ci') process.exit(2);\nif(!args.includes('--offline')||!args.includes('--ignore-scripts')||process.env.npm_config_offline!=='true'||process.env.npm_config_ignore_scripts!=='true') process.exit(3);\nconst dir=path.join(process.cwd(),'node_modules','pkg'); await mkdir(dir,{recursive:true});\nconst divergent=process.env.FIA_TEST_DIVERGE==='1'&&process.cwd().endsWith('workspace-2');\nawait writeFile(path.join(dir,'index.js'),divergent?'different\\n':'stable\\n');\nawait writeFile(path.join(dir,'package.json'),'{}\\n');\nprocess.stdout.write('installed\\n');\n`);
  await chmod(npm, 0o755);
  return { root, source, lockfile, cacheDir, cacheManifest, npm };
}

async function runFixture(f, name = 'evidence.json', extra = {}) {
  return verifyOfflineDependencyReproducibility({ source: f.source, lockfile: f.lockfile, cacheDir: f.cacheDir, cacheManifest: f.cacheManifest, output: path.join(f.root, name), attempts: 2, npm: f.npm, ...extra });
}

test('two independent offline installs produce stable evidence', async () => {
  const a = await fixture(); const b = await fixture();
  try {
    const first = await runFixture(a); const second = await runFixture(b);
    assert.equal(first.identity, second.identity);
    assert.equal(first.attempts.length, 2);
    assert.equal(first.attempts[0].inventoryIdentity, first.attempts[1].inventoryIdentity);
  } finally { await rm(a.root, { recursive: true, force: true }); await rm(b.root, { recursive: true, force: true }); }
});

test('different dependency bytes between attempts are rejected', async () => {
  const f = await fixture(); const prior = process.env.FIA_TEST_DIVERGE; process.env.FIA_TEST_DIVERGE = '1';
  try { await assert.rejects(() => runFixture(f), /inventory diverged at attempt 2/); }
  finally { if (prior === undefined) delete process.env.FIA_TEST_DIVERGE; else process.env.FIA_TEST_DIVERGE = prior; await rm(f.root, { recursive: true, force: true }); }
});

test('tampered owned cache object is rejected before npm execution', async () => {
  const f = await fixture();
  try {
    const manifest = JSON.parse(await readFile(f.cacheManifest, 'utf8'));
    await writeFile(path.join(f.cacheDir, manifest.objects[0].path), 'tampered');
    await assert.rejects(() => runFixture(f), /cache object identity mismatch/);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('cache manifest bound to another lockfile is rejected', async () => {
  const f = await fixture();
  try {
    await writeFile(f.lockfile, '{"lockfileVersion":3,"packages":{}}\n');
    await assert.rejects(() => runFixture(f), /does not bind the supplied lockfile/);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('symlinks in installed dependencies are rejected', async () => {
  const f = await fixture(); const symlinkNpm = path.join(f.root, 'symlink-npm.mjs');
  await writeFile(symlinkNpm, `#!/usr/bin/env node\nimport { mkdir, symlink } from 'node:fs/promises'; import path from 'node:path';\nif(process.argv[2]==='cache') process.exit(0); const d=path.join(process.cwd(),'node_modules','pkg'); await mkdir(d,{recursive:true}); await symlink(process.cwd(),path.join(d,'escape'));\n`);
  await chmod(symlinkNpm, 0o755);
  try { await assert.rejects(() => runFixture(f, 'evidence.json', { npm: symlinkNpm }), /symlink is not allowed/); }
  finally { await rm(f.root, { recursive: true, force: true }); }
});

test('retained evidence cannot be overwritten', async () => {
  const f = await fixture();
  try { await runFixture(f); await assert.rejects(() => runFixture(f), /destination already exists/); }
  finally { await rm(f.root, { recursive: true, force: true }); }
});
