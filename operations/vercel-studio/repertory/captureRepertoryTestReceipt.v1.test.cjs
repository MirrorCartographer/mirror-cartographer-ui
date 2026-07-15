'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { capture, discoverTests, sha256 } = require('./captureRepertoryTestReceipt.v1.cjs');
const { verifyReceipt } = require('./repertoryTestReceipt.v1.cjs');

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'mc-repertory-capture-'));
  const dir = join(root, 'operations/vercel-studio/repertory');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'b.test.cjs'), '');
  writeFileSync(join(dir, 'a.test.cjs'), '');
  writeFileSync(join(dir, 'runRepertoryTests.v1.mjs'), '');
  return root;
}

function clock(...values) {
  let index = 0;
  return () => new Date(values[index++]);
}

test('discovers repertory tests in stable repository-relative order', () => {
  const root = fixture();
  assert.deepEqual(discoverTests(root), [
    'operations/vercel-studio/repertory/a.test.cjs',
    'operations/vercel-studio/repertory/b.test.cjs'
  ]);
});

test('captures raw streams and writes a verified receipt', () => {
  const root = fixture();
  const output = capture({
    repoRoot: root,
    evidenceDirectory: 'operations/evidence',
    clock: clock('2026-07-15T19:30:00Z', '2026-07-15T19:30:01Z'),
    spawn: () => ({ status: 0, stdout: 'ok\n', stderr: '' })
  });
  assert.equal(readFileSync(output.paths.stdout, 'utf8'), 'ok\n');
  assert.equal(readFileSync(output.paths.stderr, 'utf8'), '');
  assert.deepEqual(verifyReceipt(output.receipt), { valid: true, reason: 'verified_local_test_receipt' });
  assert.equal(output.receipt.stdout_sha256, sha256('ok\n'));
  assert.equal(output.receipt.passed, true);
});

test('retains failed execution evidence without promoting success', () => {
  const root = fixture();
  const output = capture({
    repoRoot: root,
    evidenceDirectory: 'operations/evidence',
    clock: clock('2026-07-15T19:31:00Z', '2026-07-15T19:31:01Z'),
    spawn: () => ({ status: 2, stdout: '', stderr: 'failure\n' })
  });
  assert.equal(output.receipt.exit_status, 2);
  assert.equal(output.receipt.passed, false);
  assert.equal(readFileSync(output.paths.stderr, 'utf8'), 'failure\n');
});

test('converts spawn errors into failed retained evidence', () => {
  const root = fixture();
  const output = capture({
    repoRoot: root,
    evidenceDirectory: 'operations/evidence',
    clock: clock('2026-07-15T19:32:00Z', '2026-07-15T19:32:01Z'),
    spawn: () => ({ status: null, stdout: '', stderr: '', error: new Error('spawn failed') })
  });
  assert.equal(output.receipt.exit_status, 1);
  assert.equal(output.receipt.passed, false);
  assert.equal(readFileSync(output.paths.stderr, 'utf8'), 'spawn failed\n');
});

test('refuses to overwrite retained raw evidence', () => {
  const root = fixture();
  const options = {
    repoRoot: root,
    evidenceDirectory: 'operations/evidence',
    spawn: () => ({ status: 0, stdout: 'ok', stderr: '' })
  };
  capture({ ...options, clock: clock('2026-07-15T19:33:00Z', '2026-07-15T19:33:01Z') });
  assert.throws(
    () => capture({ ...options, clock: clock('2026-07-15T19:33:00Z', '2026-07-15T19:33:02Z') }),
    /EEXIST|overwrite/
  );
});

test('requires an explicit evidence directory', () => {
  assert.throws(() => capture({ repoRoot: fixture() }), /evidenceDirectory is required/);
});
