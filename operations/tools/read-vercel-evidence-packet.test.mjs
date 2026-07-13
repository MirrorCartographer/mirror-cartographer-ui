import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildPacketCommitMarker } from './vercel-evidence-packet-commit.mjs';
import { readVerifiedVercelEvidencePacket } from './read-vercel-evidence-packet.mjs';

const commit = 'b'.repeat(40);
const repository = 'MirrorCartographer/mirror-cartographer-ui';
const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'vercel-packet-reader-'));
  const receiptPath = join(dir, 'receipt.json');
  const manifestPath = join(dir, 'manifest.json');
  const markerPath = join(dir, 'packet-complete.json');
  const receiptText = '{"accepted":true,"nested":{"value":1}}\n';
  const manifest = {
    _type: 'https://in-toto.io/Statement/v1',
    predicateType: 'https://mirrorcartographer.dev/attestation/evidence-subject-manifest/v1',
    subject: [{
      name: receiptPath,
      digest: { sha256: sha256(receiptText) },
      size_bytes: Buffer.byteLength(receiptText)
    }],
    predicate: {
      schema_version: 1,
      repository,
      source_commit_sha: commit
    }
  };
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  await Promise.all([
    writeFile(receiptPath, receiptText, 'utf8'),
    writeFile(manifestPath, manifestText, 'utf8')
  ]);
  const marker = buildPacketCommitMarker({
    repository,
    source_commit_sha: commit,
    committed_at: '2026-07-13T16:34:00Z',
    receipt_path: receiptPath,
    receipt_text: receiptText,
    manifest_path: manifestPath,
    manifest_text: manifestText
  });
  await writeFile(markerPath, `${JSON.stringify(marker, null, 2)}\n`, 'utf8');
  return { markerPath, receiptPath, manifestPath };
}

test('returns subjects only after complete and coherent packet verification', async () => {
  const paths = await fixture();
  const result = await readVerifiedVercelEvidencePacket({ marker_path: paths.markerPath });
  assert.equal(result.verified, true);
  assert.equal(result.coherence_verified, true);
  assert.equal(result.repository, repository);
  assert.equal(result.receipt.accepted, true);
  assert.equal(result.manifest.predicate.source_commit_sha, commit);
  assert.equal(result.deployment_claim_permitted, false);
  assert.equal(Object.isFrozen(result.receipt.nested), true);
});

test('fails closed before exposing a tampered receipt', async () => {
  const paths = await fixture();
  await writeFile(paths.receiptPath, '{"accepted":false}\n', 'utf8');
  await assert.rejects(
    () => readVerifiedVercelEvidencePacket({ marker_path: paths.markerPath }),
    /packet_receipt_digest_mismatch/
  );
});

test('fails closed before exposing a tampered manifest', async () => {
  const paths = await fixture();
  await writeFile(paths.manifestPath, '{"subject":[]}\n', 'utf8');
  await assert.rejects(
    () => readVerifiedVercelEvidencePacket({ marker_path: paths.markerPath }),
    /packet_manifest_digest_mismatch/
  );
});

test('rejects an incomplete marker without returning partial subjects', async () => {
  const paths = await fixture();
  const marker = JSON.parse(await readFile(paths.markerPath, 'utf8'));
  marker.packet_state = 'writing';
  await writeFile(paths.markerPath, `${JSON.stringify(marker, null, 2)}\n`, 'utf8');
  await assert.rejects(
    () => readVerifiedVercelEvidencePacket({ marker_path: paths.markerPath }),
    /packet_commit_marker_invalid/
  );
});

test('rejects a byte-valid manifest that binds the receipt to another commit', async () => {
  const paths = await fixture();
  const marker = JSON.parse(await readFile(paths.markerPath, 'utf8'));
  const manifest = JSON.parse(await readFile(paths.manifestPath, 'utf8'));
  manifest.predicate.source_commit_sha = 'c'.repeat(40);
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  await writeFile(paths.manifestPath, manifestText, 'utf8');
  const rebuilt = buildPacketCommitMarker({
    repository,
    source_commit_sha: commit,
    committed_at: marker.committed_at,
    receipt_path: paths.receiptPath,
    receipt_text: await readFile(paths.receiptPath, 'utf8'),
    manifest_path: paths.manifestPath,
    manifest_text: manifestText
  });
  await writeFile(paths.markerPath, `${JSON.stringify(rebuilt, null, 2)}\n`, 'utf8');
  await assert.rejects(
    () => readVerifiedVercelEvidencePacket({ marker_path: paths.markerPath }),
    /packet_coherence_source_commit_mismatch/
  );
});
