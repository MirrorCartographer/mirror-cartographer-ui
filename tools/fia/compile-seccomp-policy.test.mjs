import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { compileSeccompPolicy } from './compile-seccomp-policy.mjs';

const base = {
  architectures: ['SCMP_ARCH_X86_64'],
  denyRawSockets: true,
};

test('equivalent unordered inputs produce identical identities', () => {
  const a = compileSeccompPolicy({ ...base, denySyscalls: ['ptrace','mount','unshare'] });
  const b = compileSeccompPolicy({ ...base, denySyscalls: ['unshare','ptrace','mount','ptrace'] });
  assert.equal(a.identity, b.identity);
  assert.deepEqual(a.oci, b.oci);
});

test('default policy denies required escape syscalls', () => {
  const p = compileSeccompPolicy({});
  assert.equal(p.invariants.namespaceCreationDenied, true);
  assert.equal(p.invariants.mountMutationDenied, true);
  assert.equal(p.invariants.kernelMutationDenied, true);
  assert.equal(p.invariants.processInspectionDenied, true);
  assert.equal(p.invariants.rawPacketSocketsDenied, true);
});

test('allow and deny overlap fails closed', () => {
  assert.throws(() => compileSeccompPolicy({ denySyscalls: ['mount'], allowSyscalls: ['mount'] }), /both allowed and denied/);
});

test('broad socket allow conflicts with raw socket denial', () => {
  assert.throws(() => compileSeccompPolicy({ allowSyscalls: ['socket'], denyRawSockets: true }), /cannot be broadly allowed/);
});

test('unsupported architectures are rejected', () => {
  assert.throws(() => compileSeccompPolicy({ architectures: ['SCMP_ARCH_MIPS'] }), /unsupported architecture/);
});

test('existing output is never overwritten', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fia-seccomp-'));
  const input = path.join(dir, 'input.json');
  const output = path.join(dir, 'compiled.json');
  await writeFile(input, '{}');
  await writeFile(output, 'sentinel');
  const result = spawnSync(process.execPath, [path.resolve('tools/fia/compile-seccomp-policy.mjs'), '--input', input, '--output', output], { cwd: path.resolve('.') });
  assert.notEqual(result.status, 0);
  assert.equal(await readFile(output, 'utf8'), 'sentinel');
});
