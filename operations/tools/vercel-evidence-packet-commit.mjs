import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

function assertNonEmptyString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${name}_missing`);
}

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export function buildPacketCommitMarker({
  repository,
  source_commit_sha,
  committed_at,
  receipt_path,
  receipt_text,
  manifest_path,
  manifest_text
}) {
  for (const [name, value] of Object.entries({
    repository,
    source_commit_sha,
    committed_at,
    receipt_path,
    receipt_text,
    manifest_path,
    manifest_text
  })) assertNonEmptyString(value, name);

  if (!/^[a-f0-9]{40}$/i.test(source_commit_sha)) throw new Error('source_commit_sha_invalid');

  const receiptSha256 = sha256(receipt_text);
  const manifestSha256 = sha256(manifest_text);
  const packetId = sha256(`${repository}\n${source_commit_sha.toLowerCase()}\n${receiptSha256}\n${manifestSha256}\n`);

  return Object.freeze({
    schema_version: 1,
    packet_state: 'complete',
    packet_id: packetId,
    repository,
    source_commit_sha: source_commit_sha.toLowerCase(),
    committed_at,
    subjects: Object.freeze([
      Object.freeze({ role: 'receipt', path: receipt_path, sha256: receiptSha256 }),
      Object.freeze({ role: 'manifest', path: manifest_path, sha256: manifestSha256 })
    ]),
    claim_ceiling: 'retained packet completeness and exact-byte identity only; workflow outcome, deployment, audio audibility, and human observation remain unproven'
  });
}

export async function verifyCommittedPacket({ marker_path }) {
  assertNonEmptyString(marker_path, 'marker_path');
  const markerText = await readFile(marker_path, 'utf8');
  const marker = JSON.parse(markerText);

  if (marker?.schema_version !== 1 || marker?.packet_state !== 'complete') {
    throw new Error('packet_commit_marker_invalid');
  }
  if (!Array.isArray(marker.subjects) || marker.subjects.length !== 2) {
    throw new Error('packet_commit_subjects_invalid');
  }

  const byRole = new Map(marker.subjects.map((subject) => [subject.role, subject]));
  const receipt = byRole.get('receipt');
  const manifest = byRole.get('manifest');
  if (!receipt || !manifest) throw new Error('packet_commit_subject_role_missing');

  const [receiptText, manifestText] = await Promise.all([
    readFile(receipt.path, 'utf8'),
    readFile(manifest.path, 'utf8')
  ]);
  if (sha256(receiptText) !== receipt.sha256) throw new Error('packet_receipt_digest_mismatch');
  if (sha256(manifestText) !== manifest.sha256) throw new Error('packet_manifest_digest_mismatch');

  const rebuilt = buildPacketCommitMarker({
    repository: marker.repository,
    source_commit_sha: marker.source_commit_sha,
    committed_at: marker.committed_at,
    receipt_path: receipt.path,
    receipt_text: receiptText,
    manifest_path: manifest.path,
    manifest_text: manifestText
  });
  if (rebuilt.packet_id !== marker.packet_id) throw new Error('packet_id_mismatch');

  return Object.freeze({
    verified: true,
    packet_id: marker.packet_id,
    source_commit_sha: marker.source_commit_sha,
    marker_path
  });
}
