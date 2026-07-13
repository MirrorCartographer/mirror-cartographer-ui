import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFreshEvidenceReceipt } from './vercel-fresh-evidence-receipt.mjs';
import { verifyFreshEvidenceReceipt } from './verify-vercel-fresh-evidence-receipt.mjs';

const commit = 'a'.repeat(40);
const digestA = '1'.repeat(64);
const digestB = '2'.repeat(64);

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'vercel-receipt-verifier-'));
  const paths = {
    reconciliation_path: join(dir, 'reconciliation.json'),
    primary_observation_path: join(dir, 'primary.json'),
    independent_observation_path: join(dir, 'independent.json')
  };
  await Promise.all([
    writeFile(paths.reconciliation_path, JSON.stringify({
      verified: true,
      target_commit_sha: commit,
      provider_ceiling_ambiguous: false,
      reasons: []
    })),
    writeFile(paths.primary_observation_path, JSON.stringify({
      commit_sha: commit,
      canonical_sha256: digestA,
      method: 'github-rest-link-pagination',
      authority: 'api.github.com',
      request_id: 'primary-1',
      retrieved_at: '2026-07-13T14:29:00Z'
    })),
    writeFile(paths.independent_observation_path, JSON.stringify({
      commit_sha: commit,
      canonical_sha256: digestB,
      method: 'gh-api-paginate-slurp',
      authority: 'api.github.com',
      request_id: 'independent-1',
      retrieved_at: '2026-07-13T14:30:00Z'
    }))
  ]);
  const request = {
    ...paths,
    target_commit_sha: commit,
    target_commit_time: '2026-07-13T14:20:00Z',
    evaluated_at: '2026-07-13T14:33:00Z',
    max_observation_age_ms: 10 * 60 * 1000,
    max_channel_skew_ms: 2 * 60 * 1000
  };
  const receiptPath = join(dir, 'receipt.json');
  await writeFreshEvidenceReceipt(request, receiptPath);
  return { paths, receiptPath };
}

test('verifies an unchanged retained receipt by replaying its assessment', async () => {
  const { receiptPath } = await fixture();
  const result = await verifyFreshEvidenceReceipt(receiptPath);
  assert.equal(result.verified, true);
  assert.deepEqual(result.reasons, []);
  assert.equal(result.deployment_claim_permitted, false);
});

test('rejects a source file changed after receipt creation', async () => {
  const { paths, receiptPath } = await fixture();
  await writeFile(paths.primary_observation_path, JSON.stringify({ changed: true }));
  const result = await verifyFreshEvidenceReceipt(receiptPath);
  assert.equal(result.verified, false);
  assert.ok(result.reasons.includes('primary_observation_digest_mismatch'));
});

test('rejects a tampered stored assessment even when source digests remain intact', async () => {
  const { receiptPath } = await fixture();
  const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
  receipt.assessment.accepted = false;
  await writeFile(receiptPath, JSON.stringify(receipt));
  const result = await verifyFreshEvidenceReceipt(receiptPath);
  assert.equal(result.verified, false);
  assert.ok(result.reasons.includes('assessment_replay_mismatch'));
});

test('rejects an elevated deployment claim flag', async () => {
  const { receiptPath } = await fixture();
  const receipt = JSON.parse(await readFile(receiptPath, 'utf8'));
  receipt.deployment_claim_permitted = true;
  await writeFile(receiptPath, JSON.stringify(receipt));
  const result = await verifyFreshEvidenceReceipt(receiptPath);
  assert.equal(result.verified, false);
  assert.ok(result.reasons.includes('deployment_claim_ceiling_violated'));
});
