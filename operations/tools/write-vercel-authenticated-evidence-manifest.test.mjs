import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateAuthenticatedEvidenceManifest, writeAuthenticatedEvidenceManifest } from './write-vercel-authenticated-evidence-manifest.mjs';

const commit = 'a'.repeat(40);
const digest = 'b'.repeat(64);
const rawHash = 'c'.repeat(64);
const records = [
  { id: 11, head_sha: commit, status: 'completed' },
  { id: 12, head_sha: commit, status: 'cancelled' }
];

function validManifest() {
  const method = {
    commit_sha: commit,
    complete: true,
    page_count: 1,
    record_count: records.length,
    raw_output_path: 'operations/evidence/raw.json',
    raw_output_sha256: rawHash,
    records
  };
  return {
    repository: 'MirrorCartographer/mirror-cartographer-ui',
    commit_sha: commit,
    captured_at: '2026-07-13T22:30:00Z',
    primary: { ...method, tool: 'repository_link_header_enumerator' },
    independent: { ...method, tool: 'gh_api_paginate_slurp' },
    stabilization: {
      first_snapshot_at: '2026-07-13T22:20:00Z',
      second_snapshot_at: '2026-07-13T22:30:00Z',
      minimum_quiet_interval_seconds: 300,
      stable: true
    },
    reconciliation: {
      verified: true,
      provider_ceiling_ambiguous: false,
      normalized_record_set_sha256: digest
    },
    claim_boundary: {
      authenticated_workflow_enumeration: true,
      deployment_identity: false,
      browser_audibility: false,
      physical_device_behavior: false
    }
  };
}

async function run() {
  const valid = validManifest();
  assert.equal(validateAuthenticatedEvidenceManifest(valid).verified, true);
  assert.equal(validateAuthenticatedEvidenceManifest({ ...valid, commit_sha: 'd'.repeat(40) }).reason, 'commit_mismatch');
  assert.equal(validateAuthenticatedEvidenceManifest({ ...valid, primary: { ...valid.primary, raw_output_sha256: '' } }).reason, 'raw_output_hash_invalid');
  assert.equal(validateAuthenticatedEvidenceManifest({ ...valid, stabilization: { ...valid.stabilization, stable: false } }).reason, 'snapshots_unstable');
  assert.equal(validateAuthenticatedEvidenceManifest({ ...valid, primary: { ...valid.primary, records: [{ ...records[0], status: 'in_progress' }, records[1]] } }).reason, 'nonterminal_record');
  assert.equal(validateAuthenticatedEvidenceManifest({ ...valid, independent: { ...valid.independent, records: [records[0]] , record_count: 1 } }).reason, 'enumeration_divergence');
  assert.equal(validateAuthenticatedEvidenceManifest({ ...valid, reconciliation: { ...valid.reconciliation, provider_ceiling_ambiguous: true } }).reason, 'provider_ceiling_ambiguous');
  assert.equal(validateAuthenticatedEvidenceManifest({ ...valid, claim_boundary: { ...valid.claim_boundary, deployment_identity: true } }).reason, 'claim_boundary_invalid');

  const dir = await mkdtemp(join(tmpdir(), 'mc-auth-manifest-'));
  const input = join(dir, 'input.json');
  const output = join(dir, 'output.json');
  await writeFile(input, JSON.stringify(valid));
  let result = await writeAuthenticatedEvidenceManifest({ input_path: input, output_path: output });
  assert.equal(result.verified, true);
  const written = JSON.parse(await readFile(output, 'utf8'));
  assert.equal(written.validation.record_count, 2);
  result = await writeAuthenticatedEvidenceManifest({ input_path: input, output_path: output });
  assert.equal(result.reason, 'output_exists');

  console.log('11 assertions passed');
}

run();
