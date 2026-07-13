import test from 'node:test';
import assert from 'node:assert/strict';
import { bindRetainedEvidenceChainReceipt } from './vercel-retained-evidence-chain-receipt.mjs';

const commit = 'a'.repeat(40);
const verifiedAt = '2026-07-13T10:43:00Z';
const binding = (path, blobSha, overrides = {}) => ({
  path,
  blob_sha: blobSha,
  target_commit: commit,
  verification_method: 'github-contents-at-commit',
  verified_at: verifiedAt,
  ...overrides
});
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
    pipeline_source_bindings: [binding('operations/tools/pipeline.mjs', 'd'.repeat(40))],
    verifier_source_bindings: [binding('operations/tools/verifier.mjs', 'e'.repeat(40), { verification_method: 'git-ls-tree-at-commit' })],
    application_deployment_attempted: false,
    deployment_claim_permitted: false
  }
};

test('creates a composite receipt bound to one exact commit and approved source proofs', () => {
  const result = bindRetainedEvidenceChainReceipt(base);
  assert.equal(result.retained_evidence_chain_verified, true);
  assert.equal(result.target_commit, commit);
  assert.equal(result.deployment_claim_permitted, false);
  assert.deepEqual(result.pipeline_source_bindings, base.chain_lock.pipeline_source_bindings);
});

test('rejects commit divergence', () => {
  assert.throws(() => bindRetainedEvidenceChainReceipt({ ...base, chain_lock: { ...base.chain_lock, target_commit: 'f'.repeat(40) } }), /target commit mismatch/);
});

test('rejects unverified receipt or unlocked verifier chain', () => {
  assert.throws(() => bindRetainedEvidenceChainReceipt({ ...base, pipeline_receipt: { ...base.pipeline_receipt, receipt_verified: false } }), /not verified/);
  assert.throws(() => bindRetainedEvidenceChainReceipt({ ...base, chain_lock: { ...base.chain_lock, receipt_chain_locked: false } }), /not locked/);
});

test('rejects missing bindings and authority escalation', () => {
  assert.throws(() => bindRetainedEvidenceChainReceipt({ ...base, chain_lock: { ...base.chain_lock, verifier_source_bindings: [] } }), /verifier source bindings missing/);
  assert.throws(() => bindRetainedEvidenceChainReceipt({ ...base, pipeline_receipt: { ...base.pipeline_receipt, deployment_claim_permitted: true } }), /deployment claim authority exceeded/);
});

test('rejects unsafe or non-normalized repository paths', () => {
  for (const path of ['/absolute.mjs', '../escape.mjs', 'ops//tool.mjs', 'ops\\tool.mjs']) {
    assert.throws(() => bindRetainedEvidenceChainReceipt({ ...base, chain_lock: { ...base.chain_lock, pipeline_source_bindings: [binding(path, 'd'.repeat(40))] } }), /repository-relative|normalized/);
  }
});

test('rejects invalid blob shas and duplicate source paths', () => {
  assert.throws(() => bindRetainedEvidenceChainReceipt({ ...base, chain_lock: { ...base.chain_lock, verifier_source_bindings: [binding('operations/tools/verifier.mjs', 'not-a-sha')] } }), /invalid verifier source bindings\[0\] blob sha/);
  assert.throws(() => bindRetainedEvidenceChainReceipt({ ...base, chain_lock: { ...base.chain_lock, pipeline_source_bindings: [binding('operations/tools/pipeline.mjs', 'd'.repeat(40)), binding('operations/tools/pipeline.mjs', 'f'.repeat(40))] } }), /duplicate path/);
});

test('rejects source proof bound to a different commit', () => {
  assert.throws(() => bindRetainedEvidenceChainReceipt({ ...base, chain_lock: { ...base.chain_lock, pipeline_source_bindings: [binding('operations/tools/pipeline.mjs', 'd'.repeat(40), { target_commit: 'f'.repeat(40) })] } }), /target commit mismatch/);
});

test('rejects missing or unapproved verification methods', () => {
  for (const verification_method of [undefined, 'working-tree-read', 'github-default-branch']) {
    assert.throws(() => bindRetainedEvidenceChainReceipt({ ...base, chain_lock: { ...base.chain_lock, pipeline_source_bindings: [binding('operations/tools/pipeline.mjs', 'd'.repeat(40), { verification_method })] } }), /verification method is not approved/);
  }
});

test('rejects missing or non-UTC verification timestamps', () => {
  for (const verified_at of [undefined, '2026-07-13', '2026-07-13T10:43:00-04:00', 'not-a-date']) {
    assert.throws(() => bindRetainedEvidenceChainReceipt({ ...base, chain_lock: { ...base.chain_lock, pipeline_source_bindings: [binding('operations/tools/pipeline.mjs', 'd'.repeat(40), { verified_at })] } }), /verified_at must be an ISO UTC timestamp/);
  }
});

test('drops unverified source-binding fields from the composite receipt', () => {
  const result = bindRetainedEvidenceChainReceipt({ ...base, chain_lock: { ...base.chain_lock, pipeline_source_bindings: [{ ...binding('operations/tools/pipeline.mjs', 'd'.repeat(40)), claimed_role: 'trusted-without-proof' }] } });
  assert.deepEqual(result.pipeline_source_bindings, [binding('operations/tools/pipeline.mjs', 'd'.repeat(40))]);
});
