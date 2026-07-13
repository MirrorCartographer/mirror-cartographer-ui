import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { verifyReconciledSourceBindingPacket } from './verify-vercel-source-binding-packet.mjs';

const COMMIT = 'a'.repeat(40);
const BLOB = 'b'.repeat(40);

function refreshDigest(value) {
  value.canonical_digest_sha256 = createHash('sha256')
    .update(JSON.stringify({ target_commit: COMMIT, bindings: value.bindings }))
    .digest('hex');
  return value;
}

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
  refreshDigest(value);
  assert.throws(() => verifyReconciledSourceBindingPacket(value), /not canonically sorted/);
});

test('rejects deployment claim escalation', () => {
  const value = packet();
  value.deployment_claim_permitted = true;
  assert.throws(() => verifyReconciledSourceBindingPacket(value), /deployment_claim_permitted/);
});

test('rejects unapproved verification methods even when distinct', () => {
  const value = packet();
  value.bindings[0].independent_methods = ['connector-first-page', 'manual-inspection'];
  refreshDigest(value);
  assert.throws(() => verifyReconciledSourceBindingPacket(value), /approved canonical methods/);
});

test('rejects reversed approved methods because method order is canonical', () => {
  const value = packet();
  value.bindings[0].independent_methods.reverse();
  refreshDigest(value);
  assert.throws(() => verifyReconciledSourceBindingPacket(value), /approved canonical methods/);
});

test('rejects malformed packet timestamps', () => {
  const value = packet();
  value.generated_at = 'not-a-time';
  assert.throws(() => verifyReconciledSourceBindingPacket(value), /UTC ISO-8601 timestamp/);
});

test('rejects binding verification after packet generation', () => {
  const value = packet();
  value.bindings[0].verified_at = '2026-07-13T12:00:01Z';
  refreshDigest(value);
  assert.throws(() => verifyReconciledSourceBindingPacket(value), /occurs after generated_at/);
});

test('rejects altered canonicalization metadata', () => {
  const value = packet();
  value.canonicalization = 'different-contract';
  assert.throws(() => verifyReconciledSourceBindingPacket(value), /canonicalization contract mismatch/);
});

test('rejects altered top-level verification method', () => {
  const value = packet();
  value.verification_method = 'manual-review';
  assert.throws(() => verifyReconciledSourceBindingPacket(value), /packet verification_method mismatch/);
});
