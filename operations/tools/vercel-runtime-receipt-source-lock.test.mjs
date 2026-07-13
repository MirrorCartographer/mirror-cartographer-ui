import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyRuntimeReceiptSourceLock } from './vercel-runtime-receipt-source-lock.mjs';

const sources = [
  { path: 'operations/tools/vercel-retained-evidence-pipeline.mjs', blob_sha: '58ae900a946f98c5441b5179e701580c615b4759' },
  { path: 'operations/tools/vercel-retained-evidence-pipeline.test.mjs', blob_sha: 'a30aad724153e093799ddafb7f4798bc903aa432' }
];

function receipt(overrides = {}) {
  return {
    queue_item: 'V-001',
    verification_state: 'runtime_test_verified',
    command: 'node --test operations/tools/vercel-retained-evidence-pipeline.test.mjs',
    exit_code: 0,
    tests: 10,
    passed: 10,
    failed: 0,
    sources,
    application_deployment_attempted: false,
    deployment_claim_permitted: false,
    ...overrides
  };
}

test('accepts an exact successful source-bound receipt', () => {
  const result = verifyRuntimeReceiptSourceLock({ receipt: receipt(), expected_sources: sources });
  assert.equal(result.source_lock_verified, true);
  assert.equal(result.source_bindings.length, 2);
  assert.equal(result.deployment_claim_permitted, false);
});

test('rejects source drift', () => {
  const changed = sources.map((source, index) => index === 0 ? { ...source, blob_sha: 'b'.repeat(40) } : source);
  assert.throws(() => verifyRuntimeReceiptSourceLock({ receipt: receipt({ sources: changed }), expected_sources: sources }), /source drift/);
});

test('rejects unsuccessful totals', () => {
  assert.throws(() => verifyRuntimeReceiptSourceLock({ receipt: receipt({ failed: 1, passed: 9 }), expected_sources: sources }), /totals/);
});

test('rejects command substitution', () => {
  assert.throws(() => verifyRuntimeReceiptSourceLock({ receipt: receipt({ command: 'node --test' }), expected_sources: sources }), /command mismatch/);
});

test('rejects deployment authority escalation', () => {
  assert.throws(() => verifyRuntimeReceiptSourceLock({ receipt: receipt({ deployment_claim_permitted: true }), expected_sources: sources }), /operations-only authority/);
});
