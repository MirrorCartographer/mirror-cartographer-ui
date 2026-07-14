import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { computeNormalizedRecordSetSha256, validateAuthenticatedEvidenceManifest, verifyRetainedExecutionDeclarations, writeAuthenticatedEvidenceManifest } from './write-vercel-authenticated-evidence-manifest.mjs';

const commit = 'a'.repeat(40);
const rawHash = 'c'.repeat(64);
const bodyHash = 'd'.repeat(64);
const records = [{ id: 11, head_sha: commit, status: 'completed' }, { id: 12, head_sha: commit, status: 'cancelled' }];
const digest = computeNormalizedRecordSetSha256(records);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function execution(client, invocation) {
  return {
    client_id: client,
    client_version: '1.0.0',
    invocation_id: invocation,
    runner_id: `${client}-runner`,
    commit_sha: commit,
    started_at: '2026-07-13T22:20:00Z',
    completed_at: '2026-07-13T22:21:00Z',
    command_argv: [client, '--commit', commit],
    environment_class: 'authenticated_repository_read'
  };
}

function receipt(method, receiptHash, requestPrefix) {
  const page2 = `https://api.github.com/repos/MirrorCartographer/mirror-cartographer-ui/actions/runs?head_sha=${commit}&page=2&per_page=1`;
  return {
    verified: true,
    commit_sha: commit,
    page_count: 2,
    record_count: records.length,
    raw_output_sha256: rawHash,
    receipt_sha256: receiptHash,
    pages: [
      { page_number: 1, request_url: `https://api.github.com/repos/MirrorCartographer/mirror-cartographer-ui/actions/runs?head_sha=${commit}&page=1&per_page=1`, next_url: page2, status: 200, request_id: `${requestPrefix}-1`, body_sha256: bodyHash, api_version_requested: '2022-11-28', api_version_selected: '2022-11-28' },
      { page_number: 2, request_url: page2, next_url: null, status: 200, request_id: `${requestPrefix}-2`, body_sha256: bodyHash, api_version_requested: '2022-11-28', api_version_selected: '2022-11-28' }
    ]
  };
}

function validManifest() {
  const primaryExecution = execution('repository_link_header_enumerator', 'primary-invocation');
  const independentExecution = execution('gh_api_paginate_slurp', 'independent-invocation');
  const method = { commit_sha: commit, complete: true, page_count: 2, record_count: records.length, raw_output_path: 'operations/evidence/raw.json', raw_output_sha256: rawHash, records };
  return {
    repository: 'MirrorCartographer/mirror-cartographer-ui', commit_sha: commit, captured_at: '2026-07-13T22:30:00Z',
    primary: { ...method, tool: 'repository_link_header_enumerator', execution: primaryExecution, execution_declaration_path: '/pending/primary.json', execution_declaration_sha256: '1'.repeat(64) },
    independent: { ...method, tool: 'gh_api_paginate_slurp', execution: independentExecution, execution_declaration_path: '/pending/independent.json', execution_declaration_sha256: '2'.repeat(64) },
    transport_receipts: { primary: receipt('primary', 'e'.repeat(64), 'primary'), independent: receipt('independent', 'f'.repeat(64), 'independent') },
    stabilization: { first_snapshot_at: '2026-07-13T22:20:00Z', second_snapshot_at: '2026-07-13T22:30:00Z', minimum_quiet_interval_seconds: 300, stable: true, first_normalized_record_set_sha256: digest, second_normalized_record_set_sha256: digest },
    reconciliation: { verified: true, provider_ceiling_ambiguous: false, normalized_record_set_sha256: digest },
    claim_boundary: { authenticated_workflow_enumeration: true, deployment_identity: false, browser_audibility: false, physical_device_behavior: false }
  };
}

async function materializeDeclarations(manifest, dir) {
  const primaryPath = join(dir, 'primary-execution.json');
  const independentPath = join(dir, 'independent-execution.json');
  const primaryBytes = `${JSON.stringify(manifest.primary.execution, null, 2)}\n`;
  const independentBytes = `${JSON.stringify(manifest.independent.execution, null, 2)}\n`;
  await writeFile(primaryPath, primaryBytes);
  await writeFile(independentPath, independentBytes);
  manifest.primary.execution_declaration_path = primaryPath;
  manifest.primary.execution_declaration_sha256 = sha256(primaryBytes);
  manifest.independent.execution_declaration_path = independentPath;
  manifest.independent.execution_declaration_sha256 = sha256(independentBytes);
  return { primaryPath, independentPath, primaryBytes, independentBytes };
}

async function run() {
  const valid = validManifest();
  assert.equal(validateAuthenticatedEvidenceManifest(valid).verified, true);
  assert.equal(computeNormalizedRecordSetSha256([...records].reverse()), digest);
  assert.equal(validateAuthenticatedEvidenceManifest({ ...valid, commit_sha: 'd'.repeat(40) }).reason, 'commit_mismatch');
  assert.equal(validateAuthenticatedEvidenceManifest({ ...valid, primary: { ...valid.primary, raw_output_sha256: '' } }).reason, 'raw_output_hash_invalid');
  assert.equal(validateAuthenticatedEvidenceManifest({ ...valid, primary: { ...valid.primary, execution_declaration_sha256: '' } }).reason, 'execution_declaration_hash_invalid');
  assert.equal(validateAuthenticatedEvidenceManifest({ ...valid, stabilization: { ...valid.stabilization, stable: false } }).reason, 'snapshots_unstable');
  assert.equal(validateAuthenticatedEvidenceManifest({ ...valid, stabilization: { ...valid.stabilization, first_normalized_record_set_sha256: '' } }).reason, 'snapshot_digest_invalid');
  assert.equal(validateAuthenticatedEvidenceManifest({ ...valid, stabilization: { ...valid.stabilization, second_normalized_record_set_sha256: '9'.repeat(64) } }).reason, 'snapshot_digest_divergence');
  assert.equal(validateAuthenticatedEvidenceManifest({ ...valid, stabilization: { ...valid.stabilization, first_normalized_record_set_sha256: '8'.repeat(64), second_normalized_record_set_sha256: '8'.repeat(64) } }).reason, 'snapshot_digest_not_bound_to_records');
  assert.equal(validateAuthenticatedEvidenceManifest({ ...valid, primary: { ...valid.primary, records: [{ ...records[0], status: 'in_progress' }, records[1]] } }).reason, 'nonterminal_record');
  assert.equal(validateAuthenticatedEvidenceManifest({ ...valid, independent: { ...valid.independent, records: [records[0]], record_count: 1 } }).reason, 'transport_record_count_mismatch');
  assert.equal(validateAuthenticatedEvidenceManifest({ ...valid, reconciliation: { ...valid.reconciliation, provider_ceiling_ambiguous: true } }).reason, 'provider_ceiling_ambiguous');
  assert.equal(validateAuthenticatedEvidenceManifest({ ...valid, claim_boundary: { ...valid.claim_boundary, deployment_identity: true } }).reason, 'claim_boundary_invalid');

  const forged = structuredClone(valid);
  forged.stabilization.first_normalized_record_set_sha256 = '7'.repeat(64);
  forged.stabilization.second_normalized_record_set_sha256 = '7'.repeat(64);
  forged.reconciliation.normalized_record_set_sha256 = '7'.repeat(64);
  assert.equal(validateAuthenticatedEvidenceManifest(forged).reason, 'snapshot_digest_not_bound_to_records');

  const metadataDivergence = structuredClone(valid);
  metadataDivergence.independent.records[0].conclusion = 'success';
  assert.equal(validateAuthenticatedEvidenceManifest(metadataDivergence).reason, 'canonical_record_set_divergence');

  const disconnected = structuredClone(valid);
  disconnected.transport_receipts.primary.pages[0].next_url = disconnected.transport_receipts.primary.pages[0].request_url;
  let result = validateAuthenticatedEvidenceManifest(disconnected);
  assert.equal(result.reason, 'pagination_chain_integrity_failed');
  assert.equal(result.chain_reason, 'pagination_chain_discontinuity');

  const replayed = structuredClone(valid);
  replayed.transport_receipts.independent.pages[1].request_url = replayed.transport_receipts.independent.pages[0].request_url;
  replayed.transport_receipts.independent.pages[0].next_url = replayed.transport_receipts.independent.pages[0].request_url;
  result = validateAuthenticatedEvidenceManifest(replayed);
  assert.equal(result.reason, 'pagination_chain_integrity_failed');
  assert.equal(result.chain_reason, 'request_url_replayed');

  const credentialed = structuredClone(valid);
  credentialed.transport_receipts.primary.pages[0].request_url += '&access_token=secret';
  result = validateAuthenticatedEvidenceManifest(credentialed);
  assert.equal(result.reason, 'pagination_chain_integrity_failed');
  assert.equal(result.chain_reason, 'request_url_invalid');

  const dir = await mkdtemp(join(tmpdir(), 'mc-auth-manifest-'));
  const input = join(dir, 'input.json'); const output = join(dir, 'output.json');
  const materialized = structuredClone(valid);
  const declarations = await materializeDeclarations(materialized, dir);

  result = await verifyRetainedExecutionDeclarations(materialized);
  assert.equal(result.verified, true);
  assert.equal(result.primary_execution_declaration_sha256, materialized.primary.execution_declaration_sha256);

  const badDigest = structuredClone(materialized);
  badDigest.primary.execution_declaration_sha256 = '0'.repeat(64);
  assert.equal((await verifyRetainedExecutionDeclarations(badDigest)).reason, 'execution_declaration_digest_mismatch');

  const invalidJsonPath = join(dir, 'invalid.json');
  await writeFile(invalidJsonPath, '{not-json');
  const invalidJson = structuredClone(materialized);
  invalidJson.primary.execution_declaration_path = invalidJsonPath;
  invalidJson.primary.execution_declaration_sha256 = sha256('{not-json');
  assert.equal((await verifyRetainedExecutionDeclarations(invalidJson)).reason, 'execution_declaration_invalid_json');

  const mismatchedPath = join(dir, 'mismatched.json');
  const mismatchedBytes = `${JSON.stringify({ ...materialized.primary.execution, runner_id: 'forged-runner' })}\n`;
  await writeFile(mismatchedPath, mismatchedBytes);
  const mismatched = structuredClone(materialized);
  mismatched.primary.execution_declaration_path = mismatchedPath;
  mismatched.primary.execution_declaration_sha256 = sha256(mismatchedBytes);
  assert.equal((await verifyRetainedExecutionDeclarations(mismatched)).reason, 'execution_declaration_content_mismatch');

  const reused = structuredClone(materialized);
  reused.independent.execution = reused.primary.execution;
  reused.independent.execution_declaration_path = declarations.primaryPath;
  reused.independent.execution_declaration_sha256 = reused.primary.execution_declaration_sha256;
  assert.equal((await verifyRetainedExecutionDeclarations(reused)).reason, 'execution_declaration_file_reused');

  const unreadable = structuredClone(materialized);
  unreadable.primary.execution_declaration_path = join(dir, 'missing.json');
  assert.equal((await verifyRetainedExecutionDeclarations(unreadable)).reason, 'execution_declaration_read_failed');

  await writeFile(input, JSON.stringify(materialized));
  result = await writeAuthenticatedEvidenceManifest({ input_path: input, output_path: output });
  assert.equal(result.verified, true);
  const written = JSON.parse(await readFile(output, 'utf8'));
  assert.equal(written.schema_version, 5);
  assert.equal(written.validation.record_count, 2);
  assert.equal(written.validation.normalized_record_set_sha256, digest);
  assert.equal(written.validation.stabilization_snapshot_sha256, digest);
  assert.equal(written.validation.primary_receipt_sha256, 'e'.repeat(64));
  assert.equal(written.retained_execution_declarations.reason, 'retained_execution_declarations_verified');
  result = await writeAuthenticatedEvidenceManifest({ input_path: input, output_path: output });
  assert.equal(result.reason, 'output_exists');
  console.log('35 assertions passed');
}
run();