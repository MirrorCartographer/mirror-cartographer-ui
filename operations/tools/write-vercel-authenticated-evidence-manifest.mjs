import { readFile, writeFile } from 'node:fs/promises';
import { validateAuthenticatedPaginationEvidence } from '../../tools/frontier-research/authenticated-pagination-evidence-gate.mjs';

const REPOSITORY = 'MirrorCartographer/mirror-cartographer-ui';
const SHA40 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;

function fail(reason, details = {}) { return { verified: false, reason, ...details }; }
function validMethod(method, commitSha) {
  if (!method || method.complete !== true) return 'enumeration_incomplete';
  if (!Number.isInteger(method.page_count) || method.page_count < 1) return 'invalid_page_count';
  if (!Number.isInteger(method.record_count) || method.record_count < 0) return 'invalid_record_count';
  if (typeof method.raw_output_path !== 'string' || method.raw_output_path.length === 0) return 'raw_output_path_missing';
  if (!SHA256.test(method.raw_output_sha256 ?? '')) return 'raw_output_hash_invalid';
  if (method.commit_sha !== commitSha) return 'commit_mismatch';
  if (!Array.isArray(method.records)) return 'records_missing';
  if (method.records.length !== method.record_count) return 'record_count_mismatch';
  const ids = new Set();
  for (const record of method.records) {
    if (!record || record.head_sha !== commitSha) return 'cross_commit_record';
    if (record.id === null || record.id === undefined || record.id === '') return 'workflow_run_id_missing';
    if (ids.has(String(record.id))) return 'duplicate_workflow_run_id';
    ids.add(String(record.id));
    if (!['completed', 'cancelled', 'skipped'].includes(record.status)) return 'nonterminal_record';
  }
  return null;
}

export function validateAuthenticatedEvidenceManifest(input) {
  if (!input || typeof input !== 'object') return fail('manifest_invalid');
  if (input.repository !== REPOSITORY) return fail('repository_mismatch');
  if (!SHA40.test(input.commit_sha ?? '')) return fail('commit_sha_invalid');
  if (Number.isNaN(Date.parse(input.captured_at))) return fail('captured_at_invalid');

  const primaryError = validMethod(input.primary, input.commit_sha);
  if (primaryError) return fail(primaryError, { method: 'primary' });
  const independentError = validMethod(input.independent, input.commit_sha);
  if (independentError) return fail(independentError, { method: 'independent' });

  const transport = validateAuthenticatedPaginationEvidence(input);
  if (!transport.verified) return transport;

  const stabilization = input.stabilization;
  if (!stabilization || stabilization.stable !== true) return fail('snapshots_unstable');
  const first = Date.parse(stabilization.first_snapshot_at);
  const second = Date.parse(stabilization.second_snapshot_at);
  if (!Number.isFinite(first) || !Number.isFinite(second) || second < first) return fail('snapshot_timestamps_invalid');
  if (!Number.isInteger(stabilization.minimum_quiet_interval_seconds) || stabilization.minimum_quiet_interval_seconds < 0) return fail('quiet_interval_invalid');
  if ((second - first) / 1000 < stabilization.minimum_quiet_interval_seconds) return fail('quiet_interval_not_met');
  if (!SHA256.test(stabilization.first_normalized_record_set_sha256 ?? '') || !SHA256.test(stabilization.second_normalized_record_set_sha256 ?? '')) return fail('snapshot_digest_invalid');
  if (stabilization.first_normalized_record_set_sha256 !== stabilization.second_normalized_record_set_sha256) return fail('snapshot_digest_divergence');

  const reconciliation = input.reconciliation;
  if (!reconciliation || reconciliation.verified !== true) return fail('reconciliation_unverified');
  if (reconciliation.provider_ceiling_ambiguous !== false) return fail('provider_ceiling_ambiguous');
  if (!SHA256.test(reconciliation.normalized_record_set_sha256 ?? '')) return fail('normalized_digest_invalid');
  if (stabilization.second_normalized_record_set_sha256 !== reconciliation.normalized_record_set_sha256) return fail('stabilization_reconciliation_digest_mismatch');
  if (input.primary.record_count >= 1000 || input.independent.record_count >= 1000) return fail('provider_ceiling_ambiguous');

  const primaryIds = input.primary.records.map((record) => String(record.id)).sort();
  const independentIds = input.independent.records.map((record) => String(record.id)).sort();
  if (JSON.stringify(primaryIds) !== JSON.stringify(independentIds)) return fail('enumeration_divergence');

  const boundary = input.claim_boundary;
  if (!boundary || boundary.deployment_identity !== false || boundary.browser_audibility !== false || boundary.physical_device_behavior !== false) return fail('claim_boundary_invalid');
  if (boundary.authenticated_workflow_enumeration !== true) return fail('claim_boundary_invalid');

  return {
    verified: true,
    reason: 'authenticated_evidence_manifest_valid',
    repository: input.repository,
    commit_sha: input.commit_sha,
    record_count: primaryIds.length,
    normalized_record_set_sha256: reconciliation.normalized_record_set_sha256,
    stabilization_snapshot_sha256: stabilization.second_normalized_record_set_sha256,
    primary_receipt_sha256: transport.primary_receipt_sha256,
    independent_receipt_sha256: transport.independent_receipt_sha256
  };
}

export async function writeAuthenticatedEvidenceManifest({ input_path, output_path }) {
  if (!input_path || !output_path) return fail('input_and_output_paths_required');
  let input;
  try { input = JSON.parse(await readFile(input_path, 'utf8')); }
  catch (error) { return fail(error instanceof SyntaxError ? 'input_invalid_json' : 'input_read_failed', { code: error.code ?? 'unknown' }); }
  const validation = validateAuthenticatedEvidenceManifest(input);
  if (!validation.verified) return validation;
  const manifest = {
    schema_version: 3,
    artifact_type: 'vercel_authenticated_workflow_evidence_manifest',
    ...input,
    validation,
    limitations: [
      'This manifest proves only the retained authenticated workflow enumeration, page-link continuity, transport provenance, and digest-bound snapshot stability described by its inputs.',
      'It does not prove semantic completeness, provider-wide absence, Vercel deployment identity, browser audibility, or physical-device behavior.'
    ]
  };
  try { await writeFile(output_path, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' }); }
  catch (error) { return fail(error.code === 'EEXIST' ? 'output_exists' : 'output_write_failed', { code: error.code ?? 'unknown' }); }
  return { verified: true, reason: 'authenticated_evidence_manifest_written', output_path, validation };
}
async function main() { const [input_path, output_path] = process.argv.slice(2); const result = await writeAuthenticatedEvidenceManifest({ input_path, output_path }); process.stdout.write(`${JSON.stringify(result, null, 2)}\n`); process.exitCode = result.verified ? 0 : 1; }
if (import.meta.url === `file://${process.argv[1]}`) main();