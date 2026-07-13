import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntimeVerificationReceipt } from './vercel-runtime-verification-receipt.mjs';

const valid = () => ({
  command: 'node --test operations/tools/vercel-retained-evidence-pipeline.test.mjs',
  exit_code: 0,
  tests: 10,
  passed: 10,
  failed: 0,
  sources: [
    { path: 'operations/tools/vercel-retained-evidence-pipeline.mjs', blob_sha: 'a'.repeat(40) },
    { path: 'operations/tools/vercel-retained-evidence-pipeline.test.mjs', blob_sha: 'b'.repeat(40) }
  ]
});

test('accepts a successful exact-source runtime verification', () => {
  const receipt = createRuntimeVerificationReceipt(valid());
  assert.equal(receipt.verification_state, 'runtime_test_verified');
  assert.equal(receipt.application_deployment_attempted, false);
  assert.equal(receipt.deployment_claim_permitted, false);
});

test('fails closed on a failing test result', () => {
  const input = valid(); input.exit_code = 1; input.passed = 9; input.failed = 1;
  assert.equal(createRuntimeVerificationReceipt(input).verification_state, 'runtime_test_failed');
});

test('rejects count drift', () => {
  const input = valid(); input.tests = 11;
  assert.throws(() => createRuntimeVerificationReceipt(input), /test count mismatch/);
});

test('rejects unapproved commands', () => {
  const input = valid(); input.command = 'npm test';
  assert.throws(() => createRuntimeVerificationReceipt(input), /unapproved test command/);
});

test('rejects unsafe paths and invalid blob identities', () => {
  const input = valid(); input.sources[0].path = '../pipeline.mjs';
  assert.throws(() => createRuntimeVerificationReceipt(input), /unsafe source path/);
  const other = valid(); other.sources[0].blob_sha = 'not-a-sha';
  assert.throws(() => createRuntimeVerificationReceipt(other), /invalid blob sha/);
});
