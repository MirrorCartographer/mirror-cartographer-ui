import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { verifyReconciledSourceBindingPacket } from './verify-vercel-source-binding-packet.mjs';

const COMMIT = 'a'.repeat(40);
const BLOB = 'b'.repeat(40);

function packet() {
  const bindings = [{
    path: 'a.json',
    blob_sha: BLOB,
    target_commit: COMMIT,
    verification_method: 'independent-exact-commit-source-reconciliation',
    verified_at: '2026-07-13T12:00:00Z',
    independent_methods: ['github-contents-at-commit', 'git-ls-tree-at-commit'],
    agreement_verified: true
  }];
  const canonical = { target_commit: COMMIT, bindings };
  return {
    schema_version: 2,
    artifact_type: 'vercel-reconciled-source-binding-packet',
    target_commit: COMMIT,
    generated_at: '2026-07-13T12:00:00Z',
    verification_method: 'independent-exact-commit-source-reconciliation',
    canonicalization: 'bindings-sorted-by-repository-path; sha256-over-target-commit-and-verification-fields',
    canonical_digest_sha256: createHash('sha256').update(JSON.stringify(canonical)).digest('hex'),
    binding_count: 1,
    bindings,
    all_bindings_agreement_verified: true,
    application_deployment_attempted: false,
    deployment_claim_permitted: false,
    trust_boundary: 'test fixture'
  };
}

test('accepts an intact packet', () => {
  assert.equal(verifyReconciledSourceBindingPacket(packet()).verified, true);
});

test('rejects digest tampering', () => {
  const value = packet();
  value.bindings[0].blob_sha = 'c'.repeat(40);
  assert.throws(() => verifyReconciledSourceBindingPacket(value), /canonical digest mismatch/);
});

test('rejects noncanonical binding order', () => {
  const value = packet();
  const later = { ...value.bindings[0], path: 'z.json', blob_sha: 'c'.repeat(40) };
  value.bindings = [later, value.bindings[0]];
  value.binding_count = 2;
  value.canonical_digest_sha256 = createHash('sha256').update(JSON.stringify({ target_commit: COMMIT, bindings: value.bindings })).digest('hex');
  assert.throws(() => verifyReconciledSourceBindingPacket(value), /not canonically sorted/);
});

test('rejects deployment claim escalation', () => {
  const value = packet();
  value.deployment_claim_permitted = true;
  assert.throws(() => verifyReconciledSourceBindingPacket(value), /deployment_claim_permitted/);
});

test('rejects duplicate verification methods', () => {
  const value = packet();
  value.bindings[0].independent_methods = ['same', 'same'];
  value.canonical_digest_sha256 = createHash('sha256').update(JSON.stringify({ target_commit: COMMIT, bindings: value.bindings })).digest('hex');
  assert.throws(() => verifyReconciledSourceBindingPacket(value), /distinct/);
});
