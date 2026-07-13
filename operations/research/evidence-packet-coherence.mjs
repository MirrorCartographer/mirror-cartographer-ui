import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function fail(reason) {
  return Object.freeze({ verified: false, reason });
}

export async function verifyEvidencePacketCoherence({ marker_path }) {
  if (typeof marker_path !== 'string' || marker_path.trim() === '') {
    throw new Error('marker_path_missing');
  }

  const marker = JSON.parse(await readFile(marker_path, 'utf8'));
  if (marker?.schema_version !== 1 || marker?.packet_state !== 'complete') {
    return fail('packet_marker_invalid');
  }
  if (typeof marker.repository !== 'string' || !/^[^/]+\/[^/]+$/.test(marker.repository)) {
    return fail('packet_repository_invalid');
  }
  if (typeof marker.source_commit_sha !== 'string' || !/^[a-f0-9]{40}$/.test(marker.source_commit_sha)) {
    return fail('packet_source_commit_invalid');
  }
  if (!Array.isArray(marker.subjects) || marker.subjects.length !== 2) {
    return fail('packet_subjects_invalid');
  }

  const byRole = new Map(marker.subjects.map((subject) => [subject?.role, subject]));
  if (byRole.size !== 2) return fail('packet_subject_roles_ambiguous');
  const receipt = byRole.get('receipt');
  const manifestSubject = byRole.get('manifest');
  if (!receipt || !manifestSubject) return fail('packet_subject_role_missing');

  const [receiptBytes, manifestBytes] = await Promise.all([
    readFile(receipt.path),
    readFile(manifestSubject.path)
  ]);
  if (sha256(receiptBytes) !== receipt.sha256) return fail('receipt_digest_mismatch');
  if (sha256(manifestBytes) !== manifestSubject.sha256) return fail('manifest_digest_mismatch');

  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  if (manifest?._type !== 'https://in-toto.io/Statement/v1') return fail('manifest_type_invalid');
  if (manifest?.predicateType !== 'https://mirrorcartographer.dev/attestation/evidence-subject-manifest/v1') {
    return fail('manifest_predicate_type_invalid');
  }
  if (manifest?.predicate?.schema_version !== 1) return fail('manifest_schema_invalid');
  if (manifest.predicate.repository !== marker.repository) return fail('repository_mismatch');
  if (manifest.predicate.source_commit_sha !== marker.source_commit_sha) return fail('source_commit_mismatch');
  if (!Array.isArray(manifest.subject) || manifest.subject.length === 0) return fail('manifest_subjects_missing');

  const manifestByName = new Map();
  for (const subject of manifest.subject) {
    if (typeof subject?.name !== 'string' || typeof subject?.digest?.sha256 !== 'string') {
      return fail('manifest_subject_invalid');
    }
    if (manifestByName.has(subject.name)) return fail('manifest_subject_name_duplicate');
    manifestByName.set(subject.name, subject);
  }

  const boundReceipt = manifestByName.get(receipt.path);
  if (!boundReceipt) return fail('receipt_not_bound_by_manifest');
  if (boundReceipt.digest.sha256 !== receipt.sha256) return fail('receipt_binding_digest_mismatch');
  if (boundReceipt.size_bytes !== receiptBytes.byteLength) return fail('receipt_binding_size_mismatch');

  return Object.freeze({
    verified: true,
    packet_id: marker.packet_id,
    repository: marker.repository,
    source_commit_sha: marker.source_commit_sha,
    receipt_path: receipt.path,
    manifest_path: manifestSubject.path,
    claim_ceiling: 'cross-artifact identity and exact-byte coherence only; producer authenticity, workflow outcome, deployment, runtime behavior, audibility, and human observation remain unproven'
  });
}
