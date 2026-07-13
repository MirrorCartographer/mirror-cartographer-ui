import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildPacketCommitMarker } from './vercel-evidence-packet-commit.mjs';
import { readVerifiedVercelEvidencePacket } from './read-vercel-evidence-packet.mjs';

const commit = 'b'.repeat(40);

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'vercel-packet-reader-'));
  const receiptPath = join(dir, 'receipt.json');
  const manifestPath = join(dir, 'manifest.json');
  const markerPath = join(dir, 'packet-complete.json');
  const receiptText = '{"accepted":true,"nested":{"value":1}}\n';
  const manifestText = '{"subjects":["receipt"]}\n';
  await Promise.all([
    writeFile(receiptPath, receiptText, 'utf8'),
    writeFile(manifestPath, manifestText, 'utf8')
  ]);
  const marker = buildPacketCommitMarker({
    repository: 'MirrorCartographer/mirror-cartographer-ui',
    source_commit_sha: commit,
    committed_at: '2026-07-13T16:27:00Z',
    receipt_path: receiptPath,
    receipt_text: receiptText,
    manifest_path: manifestPath,
    manifest_text: manifestText
  });
  await writeFile(markerPath, `${JSON.stringify(marker, null, 2)}\n`, 'utf8');
  return { markerPath, receiptPath, manifestPath };
}

test('returns receipt and manifest only after complete-packet verification', async () => {
  const paths = await fixture();
  const result = await readVerifiedVercelEvidencePacket({ marker_path: paths.markerPath });
  assert.equal(result.verified, true);
  assert.equal(result.source_commit_sha, commit);
  assert.equal(result.receipt.accepted, true);
  assert.deepEqual(result.manifest.subjects, ['receipt']);
  assert.equal(result.deployment_claim_permitted, false);
  assert.equal(Object.isFrozen(result), true);
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
  await writeFile(paths.manifestPath, '{"subjects":[]}\n', 'utf8');
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
