'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const { tmpdir } = require('node:os');
const { digest, createReceipt, verifyReceipt, writeReceiptNoOverwrite } = require('./repertoryTestReceipt.v1.cjs');

const base = () => ({
  node_version: 'v22.0.0',
  started_at: '2026-07-15T19:27:00.000Z',
  finished_at: '2026-07-15T19:27:02.000Z',
  exit_status: 0,
  test_files: ['a.test.cjs', 'b.test.cjs'],
  stdout_sha256: digest('ok'),
  stderr_sha256: digest('')
});

test('creates and verifies a fail-closed local receipt', () => {
  const receipt = createReceipt(base());
  assert.equal(receipt.passed, true);
  assert.equal(receipt.runtime_activation, false);
  assert.deepEqual(verifyReceipt(receipt), { valid: true, reason: 'verified_local_test_receipt' });
});

test('tampering invalidates the receipt digest', () => {
  const receipt = createReceipt(base());
  receipt.exit_status = 1;
  assert.deepEqual(verifyReceipt(receipt), { valid: false, reason: 'digest_mismatch' });
});

test('rejects unsorted or duplicate test discovery', () => {
  assert.throws(() => createReceipt({ ...base(), test_files: ['b.test.cjs', 'a.test.cjs'] }), /sorted/);
  assert.throws(() => createReceipt({ ...base(), test_files: ['a.test.cjs', 'a.test.cjs'] }), /unique/);
});

test('failed executions remain valid evidence but cannot claim passed', () => {
  const receipt = createReceipt({ ...base(), exit_status: 2 });
  assert.equal(receipt.passed, false);
  assert.equal(verifyReceipt(receipt).valid, true);
});

test('retained receipt writer refuses overwrite', () => {
  const dir = mkdtempSync(join(tmpdir(), 'repertory-receipt-'));
  const path = join(dir, 'receipt.json');
  const receipt = createReceipt(base());
  writeReceiptNoOverwrite(path, receipt);
  assert.equal(JSON.parse(readFileSync(path, 'utf8')).receipt_sha256, receipt.receipt_sha256);
  assert.throws(() => writeReceiptNoOverwrite(path, receipt), /refusing to overwrite/);
});

test('unsafe activation claims are rejected even with a recomputed digest', () => {
  const receipt = createReceipt(base());
  const { receipt_sha256, ...body } = receipt;
  body.runtime_activation = true;
  const forged = { ...body, receipt_sha256: digest(body) };
  assert.deepEqual(verifyReceipt(forged), { valid: false, reason: 'unsafe_claim_boundary' });
});
