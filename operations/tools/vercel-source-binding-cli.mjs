#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, writeFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';
import { reconcileExactCommitSourceBinding } from './vercel-source-binding-reconciler.mjs';

function usage() {
  return 'usage: node operations/tools/vercel-source-binding-cli.mjs <input.json> <output.json>';
}

function assertObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
}

async function assertOutputAbsent(path) {
  try {
    await access(path, constants.F_OK);
    throw new Error(`refusing to overwrite existing output: ${path}`);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

function canonicalBindingDigest(targetCommit, bindings) {
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

export function buildReconciledSourceBindingPacket(input) {
  assertObject(input, 'input');
  if (!Array.isArray(input.bindings) || input.bindings.length === 0) {
    throw new Error('input.bindings must be a non-empty array');
  }

  const seenPaths = new Set();
  const bindings = input.bindings.map((entry, index) => {
    assertObject(entry, `bindings[${index}]`);
    const reconciled = reconcileExactCommitSourceBinding({
      target_commit: input.target_commit,
      github_contents_lookup: entry.github_contents_lookup,
      git_ls_tree_lookup: entry.git_ls_tree_lookup
    });
    if (seenPaths.has(reconciled.path)) {
      throw new Error(`duplicate reconciled path: ${reconciled.path}`);
    }
    seenPaths.add(reconciled.path);
    return reconciled;
  }).sort((a, b) => a.path.localeCompare(b.path));

  const canonical_digest_sha256 = canonicalBindingDigest(input.target_commit, bindings);

  return Object.freeze({
    schema_version: 2,
    artifact_type: 'vercel-reconciled-source-binding-packet',
    target_commit: input.target_commit,
    generated_at: new Date().toISOString(),
    verification_method: 'independent-exact-commit-source-reconciliation',
    canonicalization: 'bindings-sorted-by-repository-path; sha256-over-target-commit-and-verification-fields',
    canonical_digest_sha256,
    binding_count: bindings.length,
    bindings,
    all_bindings_agreement_verified: bindings.every((binding) => binding.agreement_verified === true),
    application_deployment_attempted: false,
    deployment_claim_permitted: false,
    trust_boundary: 'This packet proves agreement between two retained source lookup methods for the listed paths and commit only; it does not prove workflow execution, deployment, runtime behavior, or physical-device audibility.'
  });
}

export async function run(argv = process.argv.slice(2)) {
  if (argv.length !== 2) throw new Error(usage());
  const [inputArg, outputArg] = argv;
  const inputPath = resolve(inputArg);
  const outputPath = resolve(outputArg);
  if (inputPath === outputPath) throw new Error('input and output paths must differ');
  await assertOutputAbsent(outputPath);

  const input = JSON.parse(await readFile(inputPath, 'utf8'));
  const packet = buildReconciledSourceBindingPacket(input);
  await writeFile(outputPath, `${JSON.stringify(packet, null, 2)}\n`, { flag: 'wx' });
  return packet;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().then(
    (packet) => process.stdout.write(`${packet.binding_count} source bindings reconciled\n`),
    (error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    }
  );
}
