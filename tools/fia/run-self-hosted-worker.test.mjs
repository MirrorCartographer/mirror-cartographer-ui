import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runSelfHostedWorker } from './run-self-hosted-worker.mjs';

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'fia-worker-test-'));
  const source = path.join(root, 'source'); await mkdir(source);
  await writeFile(path.join(source, 'input.txt'), 'owned-input\n');
  const script = path.join(root, 'job.mjs');
  await writeFile(script, `import { writeFile } from 'node:fs/promises';\nawait writeFile('result.txt', 'stable\\n');\n`);
  return { root, source, script };
}

test('equivalent worker runs produce equivalent workspace output identities', async () => {
  const fx = await fixture();
  try {
    const a = await runSelfHostedWorker({ source: fx.source, command: [process.execPath, fx.script], output: path.join(fx.root, 'a.json'), timeoutMs: 5000, networkMode: 'disabled-env', envAllowlist: [] });
    const b = await runSelfHostedWorker({ source: fx.source, command: [process.execPath, fx.script], output: path.join(fx.root, 'b.json'), timeoutMs: 5000, networkMode: 'disabled-env', envAllowlist: [] });
    assert.equal(a.output.identity, b.output.identity);
    assert.equal(a.status, 'succeeded');
    assert.equal(a.isolation.kernelEnforced, false);
  } finally { await rm(fx.root, { recursive: true, force: true }); }
});

test('secret environment variables are not inherited', async () => {
  const fx = await fixture(); const prior = process.env.FIA_SECRET_TEST; process.env.FIA_SECRET_TEST = 'should-not-leak';
  try {
    await writeFile(fx.script, `import { writeFile } from 'node:fs/promises';\nawait writeFile('secret.txt', String(process.env.FIA_SECRET_TEST));\n`);
    const record = await runSelfHostedWorker({ source: fx.source, command: [process.execPath, fx.script], output: path.join(fx.root, 'record.json'), timeoutMs: 5000, networkMode: 'disabled-env', envAllowlist: [] });
    const secret = record.output.inventory.find((entry) => entry.path === 'secret.txt');
    assert.equal(secret.bytes, 9);
  } finally { if (prior === undefined) delete process.env.FIA_SECRET_TEST; else process.env.FIA_SECRET_TEST = prior; await rm(fx.root, { recursive: true, force: true }); }
});

test('timeout kills the worker and retains failed evidence', async () => {
  const fx = await fixture();
  try {
    await writeFile(fx.script, `setInterval(() => {}, 1000);\n`);
    const output = path.join(fx.root, 'timeout.json');
    await assert.rejects(() => runSelfHostedWorker({ source: fx.source, command: [process.execPath, fx.script], output, timeoutMs: 150, networkMode: 'disabled-env', envAllowlist: [] }), /timed out/);
    const record = JSON.parse(await readFile(output, 'utf8'));
    assert.equal(record.status, 'timed-out'); assert.equal(record.execution.timedOut, true);
  } finally { await rm(fx.root, { recursive: true, force: true }); }
});

test('nonzero exit retains failed evidence and is not false success', async () => {
  const fx = await fixture();
  try {
    await writeFile(fx.script, `process.exit(7);\n`); const output = path.join(fx.root, 'failed.json');
    await assert.rejects(() => runSelfHostedWorker({ source: fx.source, command: [process.execPath, fx.script], output, timeoutMs: 5000, networkMode: 'disabled-env', envAllowlist: [] }), /exit code 7/);
    const record = JSON.parse(await readFile(output, 'utf8')); assert.equal(record.status, 'failed'); assert.equal(record.execution.exitCode, 7);
  } finally { await rm(fx.root, { recursive: true, force: true }); }
});

test('symlink contamination is rejected before execution', async (t) => {
  const fx = await fixture();
  try {
    try { await import('node:fs/promises').then(({ symlink }) => symlink('/tmp', path.join(fx.source, 'escape'))); }
    catch { t.skip('symlink unavailable'); return; }
    await assert.rejects(() => runSelfHostedWorker({ source: fx.source, command: [process.execPath, fx.script], output: path.join(fx.root, 'record.json'), timeoutMs: 5000, networkMode: 'disabled-env', envAllowlist: [] }), /symlink is not allowed/);
  } finally { await rm(fx.root, { recursive: true, force: true }); }
});

test('existing retained evidence is never overwritten', async () => {
  const fx = await fixture();
  try {
    const output = path.join(fx.root, 'record.json'); await writeFile(output, 'keep');
    await assert.rejects(() => runSelfHostedWorker({ source: fx.source, command: [process.execPath, fx.script], output, timeoutMs: 5000, networkMode: 'disabled-env', envAllowlist: [] }), /destination already exists/);
    assert.equal(await readFile(output, 'utf8'), 'keep');
  } finally { await rm(fx.root, { recursive: true, force: true }); }
});
