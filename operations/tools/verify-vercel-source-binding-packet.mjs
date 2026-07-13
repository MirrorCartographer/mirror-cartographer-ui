#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const EXPECTED_METHODS = Object.freeze([
  'github-contents-at-commit',
  'git-ls-tree-at-commit'
]);
const EXPECTED_CANONICALIZATION = 'bindings-sorted-by-repository-path; sha256-over-target-commit-and-verification-fields';
const EXPECTED_VERIFICATION_METHOD = 'independent-exact-commit-source-reconciliation';

function assertObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
}

function assertHex(value, name, length) {
  if (typeof value !== 'string' || !new RegExp(`^[0-9a-f]{${length}}$`).test(value)) {
    throw new Error(`${name} must be ${length}-character lowercase hex`);
  }
}

function assertIsoTimestamp(value, name) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) {
    throw new Error(`${name} must be a UTC ISO-8601 timestamp`);
  }
  if (Number.isNaN(Date.parse(value))) throw new Error(`${name} must be a valid timestamp`);
}

function canonicalDigest(targetCommit, bindings) {
  const canonical = {
    target_commit: targetCommit,
    bindings: bindings.map(({
      path,
      blob_sha,
      target_commit,
      verification_method,
      verified_at,
      independent_methods,
      agreement_verified
    }) => ({
      path,
      blob_sha,
      target_commit,
      verification_method,
      verified_at,
      independent_methods: [...independent_methods],
      agreement_verified
    }))
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

export function verifyReconciledSourceBindingPacket(packet) {
  assertObject(packet, 'packet');
  if (packet.schema_version !== 2) throw new Error('unsupported packet schema_version');
  if (packet.artifact_type !== 'vercel-reconciled-source-binding-packet') throw new Error('unexpected artifact_type');
  assertHex(packet.target_commit, 'target_commit', 40);
  assertHex(packet.canonical_digest_sha256, 'canonical_digest_sha256', 64);
  assertIsoTimestamp(packet.generated_at, 'generated_at');
  if (packet.verification_method !== EXPECTED_VERIFICATION_METHOD) throw new Error('packet verification_method mismatch');
  if (packet.canonicalization !== EXPECTED_CANONICALIZATION) throw new Error('canonicalization contract mismatch');
  if (!Array.isArray(packet.bindings) || packet.bindings.length === 0) throw new Error('bindings must be a non-empty array');
  if (packet.binding_count !== packet.bindings.length) throw new Error('binding_count mismatch');

  const paths = [];
  for (const [index, binding] of packet.bindings.entries()) {
    assertObject(binding, `bindings[${index}]`);
    if (typeof binding.path !== 'string' || binding.path.length === 0) throw new Error(`bindings[${index}].path must be non-empty`);
    assertHex(binding.blob_sha, `bindings[${index}].blob_sha`, 40);
    if (binding.target_commit !== packet.target_commit) throw new Error(`bindings[${index}] target_commit mismatch`);
    if (binding.verification_method !== EXPECTED_VERIFICATION_METHOD) throw new Error(`bindings[${index}] verification_method mismatch`);
    assertIsoTimestamp(binding.verified_at, `bindings[${index}].verified_at`);
    if (Date.parse(binding.verified_at) > Date.parse(packet.generated_at)) throw new Error(`bindings[${index}].verified_at occurs after generated_at`);
    if (!Array.isArray(binding.independent_methods) || binding.independent_methods.length !== EXPECTED_METHODS.length) throw new Error(`bindings[${index}] independent_methods mismatch`);
    if (JSON.stringify(binding.independent_methods) !== JSON.stringify(EXPECTED_METHODS)) throw new Error(`bindings[${index}] independent_methods must match approved canonical methods`);
    if (binding.agreement_verified !== true) throw new Error(`bindings[${index}] agreement not verified`);
    paths.push(binding.path);
  }

  const sorted = [...paths].sort((a, b) => a.localeCompare(b));
  if (JSON.stringify(paths) !== JSON.stringify(sorted)) throw new Error('bindings are not canonically sorted');
  if (new Set(paths).size !== paths.length) throw new Error('duplicate binding path');
  if (packet.all_bindings_agreement_verified !== true) throw new Error('all_bindings_agreement_verified must be true');
  if (packet.application_deployment_attempted !== false) throw new Error('application_deployment_attempted must be false');
  if (packet.deployment_claim_permitted !== false) throw new Error('deployment_claim_permitted must be false');

  const recomputed = canonicalDigest(packet.target_commit, packet.bindings);
  if (recomputed !== packet.canonical_digest_sha256) throw new Error('canonical digest mismatch');

  return Object.freeze({
    verified: true,
    target_commit: packet.target_commit,
    binding_count: packet.binding_count,
    canonical_digest_sha256: recomputed,
    deployment_claim_permitted: false
  });
}

export async function run(argv = process.argv.slice(2)) {
  if (argv.length !== 1) throw new Error('usage: node operations/tools/verify-vercel-source-binding-packet.mjs <packet.json>');
  const packet = JSON.parse(await readFile(argv[0], 'utf8'));
  return verifyReconciledSourceBindingPacket(packet);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().then(
    (result) => process.stdout.write(`${JSON.stringify(result)}\n`),
    (error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    }
  );
}
