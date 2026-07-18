import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { compileHardenedLinuxWorkerPlan } from './compile-hardened-linux-worker-plan.mjs';

const fakeIdentity = async (name) => ({ name, sha256: name.padEnd(64, '0').slice(0, 64), bytes: name.length });
const passingProbe = () => ({ available: true, status: 0, error: null });
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'fia-hard-worker-test-'));
  const workspace = path.join(root, 'workspace'); await mkdir(workspace);
  return { root, workspace };
}
const base = (workspace, output) => ({
  workspace, output, command: ['/bin/echo', 'ok'], cpuSeconds: 60,
  addressSpaceBytes: 134217728, fileSizeBytes: 1048576, openFiles: 64, processes: 16, timeoutMs: 1000,
});
const hooks = { allowNonLinux: true, probe: passingProbe, executableIdentity: fakeIdentity };

test('equivalent inputs produce identical plan identities', async () => {
  const a = await fixture(); const b = await fixture();
  try {
    const one = await compileHardenedLinuxWorkerPlan(base(a.workspace, path.join(a.root, 'plan.json')), hooks);
    const two = await compileHardenedLinuxWorkerPlan(base(b.workspace, path.join(b.root, 'plan.json')), hooks);
    assert.equal(one.identity, two.identity);
    assert.deepEqual(one.launcher, two.launcher);
  } finally { await rm(a.root, { recursive: true, force: true }); await rm(b.root, { recursive: true, force: true }); }
});

test('namespace unavailability fails closed', async () => {
  const f = await fixture();
  try {
    await assert.rejects(() => compileHardenedLinuxWorkerPlan(base(f.workspace, path.join(f.root, 'plan.json')), {
      ...hooks, probe: (binary) => binary === 'unshare' ? { available: false, status: 1, error: null } : passingProbe(),
    }), /namespaces are unavailable/);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('resource enforcement unavailability fails closed', async () => {
  const f = await fixture();
  try {
    await assert.rejects(() => compileHardenedLinuxWorkerPlan(base(f.workspace, path.join(f.root, 'plan.json')), {
      ...hooks, probe: (binary) => binary === 'prlimit' ? { available: false, status: 1, error: null } : passingProbe(),
    }), /prlimit resource enforcement is unavailable/);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('unsafe or excessive limits are rejected', async () => {
  const f = await fixture();
  try {
    await assert.rejects(() => compileHardenedLinuxWorkerPlan({ ...base(f.workspace, path.join(f.root, 'a.json')), openFiles: 1 }, hooks), /openFiles/);
    await assert.rejects(() => compileHardenedLinuxWorkerPlan({ ...base(f.workspace, path.join(f.root, 'b.json')), processes: 100000 }, hooks), /processes/);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('launcher binds all namespace and hard resource controls', async () => {
  const f = await fixture();
  try {
    const record = await compileHardenedLinuxWorkerPlan(base(f.workspace, path.join(f.root, 'plan.json')), hooks);
    assert.ok(record.launcher.includes('--mount-proc'));
    assert.ok(record.launcher.includes('--net'));
    assert.ok(record.launcher.includes('--pid'));
    assert.ok(record.launcher.includes('--nproc=16:16'));
    assert.ok(record.launcher.includes('--nofile=64:64'));
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('retained plan cannot be overwritten', async () => {
  const f = await fixture();
  try {
    const output = path.join(f.root, 'plan.json'); await writeFile(output, 'retained');
    await assert.rejects(() => compileHardenedLinuxWorkerPlan(base(f.workspace, output), hooks), /destination already exists/);
    assert.equal(await readFile(output, 'utf8'), 'retained');
  } finally { await rm(f.root, { recursive: true, force: true }); }
});
