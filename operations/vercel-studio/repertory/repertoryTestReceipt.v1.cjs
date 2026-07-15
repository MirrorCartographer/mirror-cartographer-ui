'use strict';

const { createHash } = require('node:crypto');
const { existsSync, writeFileSync } = require('node:fs');

const SCHEMA = 'mirror-cartographer.vercel-studio.repertory-test-receipt.v1';

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function assertSha256(value, field) {
  if (!/^[a-f0-9]{64}$/.test(value || '')) throw new Error(`${field} must be a lowercase SHA-256 digest`);
}

function createReceipt(input) {
  if (!input || typeof input !== 'object') throw new Error('input is required');
  if (!Array.isArray(input.test_files) || input.test_files.length === 0) throw new Error('test_files must be non-empty');
  if (new Set(input.test_files).size !== input.test_files.length) throw new Error('test_files must be unique');
  if (input.test_files.some((file) => typeof file !== 'string' || !file.endsWith('.test.cjs'))) {
    throw new Error('every test file must end with .test.cjs');
  }
  if (input.test_files.some((file, index, files) => index > 0 && files[index - 1].localeCompare(file) > 0)) {
    throw new Error('test_files must be sorted');
  }
  if (!Number.isInteger(input.exit_status) || input.exit_status < 0) throw new Error('exit_status must be a non-negative integer');
  assertSha256(input.stdout_sha256, 'stdout_sha256');
  assertSha256(input.stderr_sha256, 'stderr_sha256');
  if (!/^\d{4}-\d{2}-\d{2}T/.test(input.started_at || '') || !/^\d{4}-\d{2}-\d{2}T/.test(input.finished_at || '')) {
    throw new Error('started_at and finished_at must be ISO timestamps');
  }
  if (Date.parse(input.finished_at) < Date.parse(input.started_at)) throw new Error('finished_at cannot precede started_at');

  const body = {
    schema: SCHEMA,
    command: 'node operations/vercel-studio/repertory/runRepertoryTests.v1.mjs',
    node_version: input.node_version,
    started_at: input.started_at,
    finished_at: input.finished_at,
    exit_status: input.exit_status,
    passed: input.exit_status === 0,
    test_files: input.test_files,
    stdout_sha256: input.stdout_sha256,
    stderr_sha256: input.stderr_sha256,
    runtime_activation: false,
    deployment_created: false,
    audio_autoplay: false,
    evidence_class: 'local_test_execution_only'
  };
  return { ...body, receipt_sha256: digest(body) };
}

function verifyReceipt(receipt) {
  if (!receipt || receipt.schema !== SCHEMA) return { valid: false, reason: 'schema_mismatch' };
  const { receipt_sha256, ...body } = receipt;
  if (digest(body) !== receipt_sha256) return { valid: false, reason: 'digest_mismatch' };
  if (body.runtime_activation !== false || body.deployment_created !== false || body.audio_autoplay !== false) {
    return { valid: false, reason: 'unsafe_claim_boundary' };
  }
  if (body.passed !== (body.exit_status === 0)) return { valid: false, reason: 'status_mismatch' };
  return { valid: true, reason: 'verified_local_test_receipt' };
}

function writeReceiptNoOverwrite(path, receipt) {
  if (existsSync(path)) throw new Error(`refusing to overwrite retained receipt: ${path}`);
  const verification = verifyReceipt(receipt);
  if (!verification.valid) throw new Error(`invalid receipt: ${verification.reason}`);
  writeFileSync(path, `${JSON.stringify(receipt, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
}

module.exports = { SCHEMA, canonicalize, digest, createReceipt, verifyReceipt, writeReceiptNoOverwrite };
