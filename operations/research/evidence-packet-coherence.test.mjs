import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { verifyEvidencePacketCoherence } from './evidence-packet-coherence.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const commit = 'a'.repeat(40);

async function fixture({ markerRepository = 'MirrorCartographer/mirror-cartographer-ui', manifestRepository = markerRepository, markerCommit = commit, manifestCommit = markerCommit, tamperReceipt = false, bindReceipt = true } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'packet-coherence-'));
  const receiptPath = join(dir, 'receipt.json');
  const manifestPath = join(dir, 'manifest.json');
  const markerPath = join(dir, 'marker.json');
  const receiptBytes = Buffer.from('{"verified":true}\n');
  await writeFile(receiptPath, receiptBytes);
  const manifest = {
    _type: 'https://in-toto.io/Statement/v1',
    subject: bindReceipt ? [{ name: receiptPath, digest: { sha256: sha256(receiptBytes) }, size_bytes: receiptBytes.byteLength }] : [{ name: 'other.json', digest: { sha256: 'b'.repeat(64) }, size_bytes: 1 }],
    predicateType: 'https://mirrorcartographer.dev/attestation/evidence-subject-manifest/v1',
    predicate: { schema_version: 1, repository: manifestRepository, source_commit_sha: manifestCommit, generated_at: '2026-07-13T16:27:48Z' }
  };
  const manifestBytes = Buffer.from(JSON.stringify(manifest));
  await writeFile(manifestPath, manifestBytes);
  const marker = {
    schema_version: 1,
    packet_state: 'complete',
    packet_id: 'c'.repeat(64),
    repository: markerRepository,
    source_commit_sha: markerCommit,
    committed_at: '2026-07-13T16:27:48Z',
    subjects: [
      { role: 'receipt', path: receiptPath, sha256: sha256(receiptBytes) },
      { role: 'manifest', path: manifestPath, sha256: sha256(manifestBytes) }
    ]
  };
  await writeFile(markerPath, JSON.stringify(marker));
  if (tamperReceipt) await writeFile(receiptPath, '{"verified":false}\n');
  return markerPath;
}

test('accepts coherent complete packet', async () => {
  const result = await verifyEvidencePacketCoherence({ marker_path: await fixture() });
  assert.equal(result.verified, true);
  assert.equal(result.repository, 'MirrorCartographer/mirror-cartographer-ui');
});

test('rejects repository mismatch', async () => {
  const result = await verifyEvidencePacketCoherence({ marker_path: await fixture({ manifestRepository: 'other/repo' }) });
  assert.deepEqual(result, { verified: false, reason: 'repository_mismatch' });
});

test('rejects source commit mismatch', async () => {
  const result = await verifyEvidencePacketCoherence({ marker_path: await fixture({ manifestCommit: 'b'.repeat(40) }) });
  assert.deepEqual(result, { verified: false, reason: 'source_commit_mismatch' });
});

test('rejects post-publication receipt tampering', async () => {
  const result = await verifyEvidencePacketCoherence({ marker_path: await fixture({ tamperReceipt: true }) });
  assert.deepEqual(result, { verified: false, reason: 'receipt_digest_mismatch' });
});

test('rejects receipt omitted from subject manifest', async () => {
  const result = await verifyEvidencePacketCoherence({ marker_path: await fixture({ bindReceipt: false }) });
  assert.deepEqual(result, { verified: false, reason: 'receipt_not_bound_by_manifest' });
});
