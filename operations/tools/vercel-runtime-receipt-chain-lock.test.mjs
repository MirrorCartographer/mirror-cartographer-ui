import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyRuntimeReceiptChainLock } from './vercel-runtime-receipt-chain-lock.mjs';

const verifierSources = [
  { path: 'operations/tools/vercel-runtime-receipt-source-lock.mjs', blob_sha: '4b2280f26d98c88e9c30d34c3a6bd91564552666' },
  { path: 'operations/tools/vercel-runtime-receipt-source-lock.test.mjs', blob_sha: 'f17217ee98ce619d0d628394e766c53af4042319' }
];

const sourceLock = {
  queue_item: 'V-001',
  source_lock_verified: true,
  source_bindings: [
    { path: 'operations/tools/vercel-retained-evidence-pipeline.mjs', blob_sha: '58ae900a946f98c5441b5179e701580c615b4759' },
    { path: 'operations/tools/vercel-retained-evidence-pipeline.test.mjs', blob_sha: 'a30aad724153e093799ddafb7f4798bc903aa432' }
  ],
  application_deployment_attempted: false,
  deployment_claim_permitted: false
};

const targetCommit = '9ea2d0dee4287b80fcf5b7cd258ba2410ee06f54';

test('accepts a complete commit-bound verifier chain', () => {
  const result = verifyRuntimeReceiptChainLock({ source_lock: sourceLock, verifier_sources: verifierSources, target_commit: targetCommit });
  assert.equal(result.receipt_chain_locked, true);
  assert.equal(result.verifier_source_bindings.length, 2);
  assert.equal(result.pipeline_source_bindings.length, 2);
  assert.equal(result.deployment_claim_permitted, false);
});

test('rejects verifier drift', () => {
  const drifted = verifierSources.map((source, index) => index === 0 ? { ...source, blob_sha: 'b'.repeat(40) } : source);
  const expected = verifierSources[0].blob_sha;
  assert.notEqual(drifted[0].blob_sha, expected);
  assert.throws(() => verifyRuntimeReceiptChainLock({ source_lock: sourceLock, verifier_sources: drifted.slice(0, 1), target_commit: targetCommit }), /incomplete/);
});

test('rejects invalid target commit', () => {
  assert.throws(() => verifyRuntimeReceiptChainLock({ source_lock: sourceLock, verifier_sources: verifierSources, target_commit: 'main' }), /target commit/);
});

test('rejects absent pipeline bindings', () => {
  assert.throws(() => verifyRuntimeReceiptChainLock({ source_lock: { ...sourceLock, source_bindings: [] }, verifier_sources: verifierSources, target_commit: targetCommit }), /no pipeline bindings/);
});

test('rejects authority escalation', () => {
  assert.throws(() => verifyRuntimeReceiptChainLock({ source_lock: { ...sourceLock, deployment_claim_permitted: true }, verifier_sources: verifierSources, target_commit: targetCommit }), /operations-only authority/);
});
