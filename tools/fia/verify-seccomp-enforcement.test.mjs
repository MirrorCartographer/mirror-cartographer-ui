import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, chmod } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { compileSeccompPolicy } from './compile-seccomp-policy.mjs';
import { verifySeccompEnforcement } from './verify-seccomp-enforcement.mjs';

async function fixture(overrides = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'fia-seccomp-verify-'));
  const policy = compileSeccompPolicy({});
  const policyPath = path.join(dir, 'policy.json');
  await writeFile(policyPath, JSON.stringify(policy));
  const probePath = path.join(dir, 'probe.mjs');
  const report = {
    schema: 'fia.seccomp-probe-result.v1', policyIdentity: policy.identity, filterLoaded: true,
    probes: {
      baseline: { executed: true, allowed: true },
      ptrace: { executed: true, denied: true, errno: 1 },
      namespace: { executed: true, denied: true, errno: 1 },
      mount: { executed: true, denied: true, errno: 1 },
      rawSocket: { executed: true, denied: true, errno: 1 }
    },
    ...overrides
  };
  await writeFile(probePath, `#!/usr/bin/env node\nprocess.stdout.write(${JSON.stringify(JSON.stringify(report))});\n`);
  await chmod(probePath, 0o700);
  return { dir, policy, policyPath, probePath };
}

test('equivalent independent verification runs produce identical identities', async () => {
  const a = await fixture();
  const b = await fixture();
  const va = await verifySeccompEnforcement({ policyPath: a.policyPath, probeCommand: [a.probePath] });
  const vb = await verifySeccompEnforcement({ policyPath: b.policyPath, probeCommand: [b.probePath] });
  assert.equal(va.identity, vb.identity);
});

test('rejects a modified policy with stale identity', async () => {
  const f = await fixture();
  const policy = JSON.parse(await readFile(f.policyPath, 'utf8'));
  policy.policy.errno = 13;
  await writeFile(f.policyPath, JSON.stringify(policy));
  await assert.rejects(() => verifySeccompEnforcement({ policyPath: f.policyPath, probeCommand: [f.probePath] }), /identity mismatch/);
});

test('rejects probe that did not load filter', async () => {
  const f = await fixture({ filterLoaded: false });
  await assert.rejects(() => verifySeccompEnforcement({ policyPath: f.policyPath, probeCommand: [f.probePath] }), /did not prove/);
});

test('rejects probe bound to another policy', async () => {
  const f = await fixture({ policyIdentity: '0'.repeat(64) });
  await assert.rejects(() => verifySeccompEnforcement({ policyPath: f.policyPath, probeCommand: [f.probePath] }), /different policy/);
});

test('rejects unexecuted denial probe', async () => {
  const f = await fixture({ probes: {
    baseline: { executed: true, allowed: true }, ptrace: { executed: false, denied: true, errno: 1 },
    namespace: { executed: true, denied: true, errno: 1 }, mount: { executed: true, denied: true, errno: 1 }, rawSocket: { executed: true, denied: true, errno: 1 }
  }});
  await assert.rejects(() => verifySeccompEnforcement({ policyPath: f.policyPath, probeCommand: [f.probePath] }), /ptrace denial probe was not executed/);
});

test('rejects denial probe that is unexpectedly allowed', async () => {
  const f = await fixture({ probes: {
    baseline: { executed: true, allowed: true }, ptrace: { executed: true, denied: false, errno: 0 },
    namespace: { executed: true, denied: true, errno: 1 }, mount: { executed: true, denied: true, errno: 1 }, rawSocket: { executed: true, denied: true, errno: 1 }
  }});
  await assert.rejects(() => verifySeccompEnforcement({ policyPath: f.policyPath, probeCommand: [f.probePath] }), /ptrace denial probe was not denied/);
});
