import test from 'node:test';
import assert from 'node:assert/strict';
import { bindRetainedEvidenceChainReceipt } from './vercel-retained-evidence-chain-receipt.mjs';

const commit = 'a'.repeat(40);
const base = {
  pipeline_receipt: {
    schema_version: 1,
    queue_item: 'V-001',
    target_commit: commit,
    receipt_verified: true,
    manifest_sha256: 'b'.repeat(64),
    retained_artifact_digests: { primary_raw: 'c'.repeat(64) },
    application_deployment_attempted: false,
    deployment_claim_permitted: false
  },
  chain_lock: {
    schema_version: 1,
    queue_item: 'V-001',
    target_commit: commit,
    receipt_chain_locked: true,
    pipeline_source_bindings: [{ path: 'pipeline.mjs', blob_sha: 'd'.repeat(40) }],
    verifier_source_bindings: [{ path: 'verifier.mjs', blob_sha: 'e'.repeat(40) }],
    application_deployment_attempted: false,
    deployment_claim_permitted: false
  }
};

test('creates a composite receipt bound to one exact commit', () => {
  const result = bindRetainedEvidenceChainReceipt(base);
  assert.equal(result.retained_evidence_chain_verified, true);
  assert.equal(result.target_commit, commit);
  assert.equal(result.deployment_claim_permitted, false);
});

test('rejects commit divergence', () => {
  assert.throws(() => bindRetainedEvidenceChainReceipt({
    ...base,
    chain_lock: { ...base.chain_lock, target_commit: 'f'.repeat(40) }
  }), /target commit mismatch/);
});

test('rejects unverified receipt or unlocked verifier chain', () => {
  assert.throws(() => bindRetainedEvidenceChainReceipt({
    ...base,
    pipeline_receipt: { ...base.pipeline_receipt, receipt_verified: false }
  }), /not verified/);
  assert.throws(() => bindRetainedEvidenceChainReceipt({
    ...base,
    chain_lock: { ...base.chain_lock, receipt_chain_locked: false }
  }), /not locked/);
});

test('rejects missing bindings and authority escalation', () => {
  assert.throws(() => bindRetainedEvidenceChainReceipt({
    ...base,
    chain_lock: { ...base.chain_lock, verifier_source_bindings: [] }
  }), /verifier source bindings missing/);
  assert.throws(() => bindRetainedEvidenceChainReceipt({
    ...base,
    pipeline_receipt: { ...base.pipeline_receipt, deployment_claim_permitted: true }
  }), /deployment claim authority exceeded/);
});
