import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildPacketCommitMarker,
  verifyCommittedPacket
} from './vercel-evidence-packet-commit.mjs';

const commit = 'a'.repeat(40);

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'vercel-packet-commit-'));
  const receiptPath = join(dir, 'receipt.json');
  const manifestPath = join(dir, 'manifest.json');
  const markerPath = join(dir, 'packet-complete.json');
  const receiptText = '{"accepted":true}\n';
  const manifestText = '{"subject":[]}\n';
  await Promise.all([
    writeFile(receiptPath, receiptText, 'utf8'),
    writeFile(manifestPath, manifestText, 'utf8')
  ]);
  const marker = buildPacketCommitMarker({
    repository: 'MirrorCartographer/mirror-cartographer-ui',
    source_commit_sha: commit,
    committed_at: '2026-07-13T16:12:00Z',
    receipt_path: receiptPath,
    receipt_text: receiptText,
    manifest_path: manifestPath,
    manifest_text: manifestText
  });
  await writeFile(markerPath, `${JSON.stringify(marker, null, 2)}\n`, 'utf8');
  return { markerPath, receiptPath, manifestPath };
}

test('verifies a complete exact-byte packet', async () => {
  const paths = await fixture();
  const result = await verifyCommittedPacket({ marker_path: paths.markerPath });
  assert.equal(result.verified, true);
  assert.equal(result.source_commit_sha, commit);
  assert.match(result.packet_id, /^[a-f0-9]{64}$/);
});

test('rejects a packet when the receipt changes after commit', async () => {
  const paths = await fixture();
  await writeFile(paths.receiptPath, '{"accepted":false}\n', 'utf8');
  await assert.rejects(
    () => verifyCommittedPacket({ marker_path: paths.markerPath }),
    /packet_receipt_digest_mismatch/
  );
});

test('rejects a packet when the manifest changes after commit', async () => {
  const paths = await fixture();
  await writeFile(paths.manifestPath, '{"subject":["changed"]}\n', 'utf8');
  await assert.rejects(
    () => verifyCommittedPacket({ marker_path: paths.markerPath }),
    /packet_manifest_digest_mismatch/
  );
});

test('rejects an incomplete marker even when files exist', async () => {
  const paths = await fixture();
  const marker = JSON.parse(await readFile(paths.markerPath, 'utf8'));
  marker.packet_state = 'writing';
  await writeFile(paths.markerPath, `${JSON.stringify(marker, null, 2)}\n`, 'utf8');
  await assert.rejects(
    () => verifyCommittedPacket({ marker_path: paths.markerPath }),
    /packet_commit_marker_invalid/
  );
});
