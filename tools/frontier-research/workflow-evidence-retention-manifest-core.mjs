import { createHash } from 'node:crypto';

const REQUIRED_ROLES = Object.freeze([
  'primary_raw_enumeration',
  'independent_raw_pages',
  'independent_command',
  'primary_envelope',
  'independent_envelope',
  'reconciliation_result',
  'promotion_assessment'
]);

function sha256Utf8(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function fail(reason, evidenceStrength = 'retention_manifest_invalid') {
  return { verified: false, reason, evidence_strength: evidenceStrength };
}

export function verifyWorkflowEvidenceRetentionManifest({ manifest, retainedArtifacts }) {
  if (!manifest || manifest.schema_version !== 1) return fail('manifest_schema_unsupported');
  if (manifest.artifact_type !== 'workflow_evidence_retention_manifest') return fail('manifest_type_invalid');
  if (!/^[0-9a-f]{40}$/.test(manifest.commit_sha ?? '')) return fail('commit_sha_invalid');
  if (!Array.isArray(manifest.entries)) return fail('manifest_entries_required');
  if (!retainedArtifacts || typeof retainedArtifacts !== 'object') return fail('retained_artifacts_required');

  const entriesByRole = new Map();
  for (const entry of manifest.entries) {
    if (!entry || typeof entry.role !== 'string') return fail('entry_role_invalid');
    if (entriesByRole.has(entry.role)) return fail('duplicate_role');
    entriesByRole.set(entry.role, entry);
  }

  for (const role of REQUIRED_ROLES) {
    if (!entriesByRole.has(role)) return fail(`required_role_missing:${role}`, 'retention_set_incomplete');
  }

  const unexpectedRoles = [...entriesByRole.keys()].filter((role) => !REQUIRED_ROLES.includes(role));
  if (unexpectedRoles.length > 0) return fail(`unexpected_role:${unexpectedRoles[0]}`);

  const verifiedEntries = [];
  for (const role of REQUIRED_ROLES) {
    const entry = entriesByRole.get(role);
    if (entry.commit_sha !== manifest.commit_sha) return fail(`entry_commit_mismatch:${role}`, 'cross_commit_retention_set');
    if (entry.media_type !== 'application/json' && entry.media_type !== 'text/plain') {
      return fail(`entry_media_type_invalid:${role}`);
    }
    if (typeof entry.path !== 'string' || entry.path.length === 0) return fail(`entry_path_invalid:${role}`);
    if (typeof retainedArtifacts[role] !== 'string') return fail(`retained_artifact_missing:${role}`, 'retention_set_incomplete');

    const text = retainedArtifacts[role];
    const byteLength = Buffer.byteLength(text, 'utf8');
    if (entry.byte_length !== byteLength) return fail(`byte_length_mismatch:${role}`, 'retained_artifact_binding_failed');

    const digest = sha256Utf8(text);
    if (entry.sha256 !== digest) return fail(`sha256_mismatch:${role}`, 'retained_artifact_binding_failed');

    verifiedEntries.push({ role, path: entry.path, sha256: digest, byte_length: byteLength });
  }

  return {
    verified: true,
    reason: 'complete_exact_commit_retention_set_verified',
    evidence_strength: 'byte_bound_complete_exact_commit_retention_set',
    commit_sha: manifest.commit_sha,
    required_roles: [...REQUIRED_ROLES],
    verified_entries: verifiedEntries
  };
}

export { REQUIRED_ROLES };
