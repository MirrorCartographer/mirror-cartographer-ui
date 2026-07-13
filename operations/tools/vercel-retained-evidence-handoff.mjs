const SHA40 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const REQUIRED_ROLES = Object.freeze([
  'primary_raw',
  'independent_raw',
  'independent_command',
  'reconciliation'
]);

function assertObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
}

export function assessRetainedEvidenceHandoff(input) {
  assertObject(input, 'input');
  const {
    expected_commit_sha,
    manifest,
    raw_bytes_reverified,
    reconciliation_verified,
    provider_ceiling_ambiguous
  } = input;

  if (!SHA40.test(expected_commit_sha ?? '')) {
    throw new Error('expected_commit_sha must be 40 lowercase hex characters');
  }
  assertObject(manifest, 'manifest');
  for (const [name, value] of Object.entries({
    raw_bytes_reverified,
    reconciliation_verified,
    provider_ceiling_ambiguous
  })) {
    if (typeof value !== 'boolean') throw new TypeError(`${name} must be boolean`);
  }

  const blockers = [];
  if (manifest.schema_version !== 1) blockers.push('unsupported_manifest_schema');
  if (manifest.commit_sha !== expected_commit_sha) blockers.push('manifest_commit_mismatch');
  if (manifest.evidence_complete !== true) blockers.push('manifest_not_complete');
  if (manifest.deployment_claim_permitted !== false) blockers.push('manifest_claim_boundary_invalid');
  if (!SHA256.test(manifest.manifest_sha256 ?? '')) blockers.push('manifest_digest_invalid');
  if (!Number.isInteger(manifest.capture_window_ms) || manifest.capture_window_ms < 0) {
    blockers.push('capture_window_invalid');
  }

  const artifacts = Array.isArray(manifest.artifacts) ? manifest.artifacts : [];
  const roles = new Set();
  for (const artifact of artifacts) {
    if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) continue;
    if (typeof artifact.role === 'string') roles.add(artifact.role);
  }
  for (const role of REQUIRED_ROLES) {
    if (!roles.has(role)) blockers.push(`missing_artifact_role_${role}`);
  }
  if (artifacts.length !== REQUIRED_ROLES.length) blockers.push('artifact_cardinality_invalid');
  if (!raw_bytes_reverified) blockers.push('retained_raw_bytes_not_reverified');
  if (!reconciliation_verified) blockers.push('reconciliation_not_reverified');
  if (provider_ceiling_ambiguous) blockers.push('provider_ceiling_ambiguous');

  const accepted = blockers.length === 0;
  return Object.freeze({
    schema_version: 1,
    expected_commit_sha,
    handoff_status: accepted ? 'accepted' : 'blocked',
    exhaustive_workflow_evidence: accepted,
    deployment_claim_permitted: false,
    blockers: Object.freeze(blockers),
    reason: accepted ? 'retained_evidence_reverified_for_exact_commit' : blockers[0]
  });
}
