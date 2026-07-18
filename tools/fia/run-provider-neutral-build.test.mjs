import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runProviderNeutralBuild } from './run-provider-neutral-build.mjs';

function sha256(value) { return createHash('sha256').update(value).digest('hex'); }
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'fia-provider-neutral-test-'));
  const source = path.join(root, 'source');
  await mkdir(path.join(source, 'src'), { recursive: true });
  const packageBytes = Buffer.from(`${JSON.stringify({ name: 'fixture', version: '1.0.0', scripts: { build: 'fixture-build' } }, null, 2)}\n`);
  await writeFile(path.join(source, 'package.json'), packageBytes);
  await writeFile(path.join(source, 'src', 'input.txt'), 'owned-input\n');
  const material = {
    schema: 'fia.provider-neutral-build-plan.v1',
    package: { sha256: sha256(packageBytes), bytes: packageBytes.length, name: 'fixture', version: '1.0.0' },
    config: { sha256: '0'.repeat(64), bytes: 1 },
    buildScript: 'build',
    scriptGraph: [{ name: 'build', command: 'fixture-build', dependencies: [] }],
    inputs: ['package.json', 'src'],
    output: 'dist',
    envAllowlist: ['LANG', 'TZ'],
    deniedProviders: ['vercel'],
    policy: { hostedBuildAuthority: false, providerSpecificEnvironment: false, networkRequired: false, overwriteExistingPlan: false }
  };
  const plan = { ...material, identity: sha256(canonical(material)) };
  const planPath = path.join(root, 'plan.json');
  await writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`);
  return { root, source, planPath, packagePath: path.join(source, 'package.json'), plan };
}
function fakeSpawn(effect) {
  let count = 0;
  return (_cmd, _args, options) => {
    count += 1;
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.pid = 9000 + count;
    child.kill = () => {};
    queueMicrotask(async () => {
      try {
        await effect({ cwd: options.cwd, env: options.env, attempt: count, stdout: child.stdout, stderr: child.stderr });
        child.stdout.end(); child.stderr.end();
        child.emit('close', 0, null);
      } catch (error) {
        child.stderr.end(String(error)); child.stdout.end();
        child.emit('close', 1, null);
      }
    });
    return child;
  };
}
async function buildDist({ cwd, attempt, env }, content = 'same\n') {
  assert.equal(env.SECRET_TOKEN, undefined);
  assert.equal(env.HTTP_PROXY, 'http://127.0.0.1:9');
  await mkdir(path.join(cwd, 'dist'), { recursive: true });
  await writeFile(path.join(cwd, 'dist', 'index.html'), typeof content === 'function' ? content(attempt) : content);
}

test('equivalent independent builds produce identical run identities', async () => {
  const a = await fixture(); const b = await fixture();
  try {
    const options = { attempts: 2, timeoutMs: 1000, hostEnv: { LANG: 'C', SECRET_TOKEN: 'hidden' } };
    const runA = await runProviderNeutralBuild({ planPath: a.planPath, packagePath: a.packagePath, sourcePath: a.source, spawnImpl: fakeSpawn(buildDist), ...options });
    const runB = await runProviderNeutralBuild({ planPath: b.planPath, packagePath: b.packagePath, sourcePath: b.source, spawnImpl: fakeSpawn(buildDist), ...options });
    assert.equal(runA.identity, runB.identity);
    assert.equal(runA.artifactIdentity, runB.artifactIdentity);
  } finally { await rm(a.root, { recursive: true, force: true }); await rm(b.root, { recursive: true, force: true }); }
});

test('stale or substituted plan identity is rejected', async () => {
  const f = await fixture();
  try {
    const plan = JSON.parse(await readFile(f.planPath)); plan.output = 'other'; await writeFile(f.planPath, JSON.stringify(plan));
    await assert.rejects(() => runProviderNeutralBuild({ planPath: f.planPath, packagePath: f.packagePath, sourcePath: f.source, spawnImpl: fakeSpawn(buildDist) }), /identity mismatch/);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('package script substitution is rejected', async () => {
  const f = await fixture();
  try {
    await writeFile(f.packagePath, '{"scripts":{"build":"vercel build"}}\n');
    await assert.rejects(() => runProviderNeutralBuild({ planPath: f.planPath, packagePath: f.packagePath, sourcePath: f.source, spawnImpl: fakeSpawn(buildDist) }), /package.json does not match/);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('writes outside the declared output are rejected', async () => {
  const f = await fixture();
  try {
    const spawnImpl = fakeSpawn(async args => { await buildDist(args); await writeFile(path.join(args.cwd, 'rogue.txt'), 'escape'); });
    await assert.rejects(() => runProviderNeutralBuild({ planPath: f.planPath, packagePath: f.packagePath, sourcePath: f.source, spawnImpl }), /wrote outside output/);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('cross-attempt artifact divergence is rejected', async () => {
  const f = await fixture();
  try {
    const spawnImpl = fakeSpawn(args => buildDist(args, attempt => `attempt-${attempt}\n`));
    await assert.rejects(() => runProviderNeutralBuild({ planPath: f.planPath, packagePath: f.packagePath, sourcePath: f.source, spawnImpl }), /artifact divergence/);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('symlink-contaminated admitted inputs are rejected', async (t) => {
  if (process.platform === 'win32') return t.skip('symlink permissions vary on Windows');
  const f = await fixture();
  try {
    const { symlink } = await import('node:fs/promises');
    await symlink('/tmp', path.join(f.source, 'src', 'escape'));
    await assert.rejects(() => runProviderNeutralBuild({ planPath: f.planPath, packagePath: f.packagePath, sourcePath: f.source, spawnImpl: fakeSpawn(buildDist) }), /symbolic links are forbidden/);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});
