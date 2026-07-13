import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildFreshEvidenceReceipt, writeFreshEvidenceReceipt } from './vercel-fresh-evidence-receipt.mjs';

const commit = 'a'.repeat(40);
const digestA = '1'.repeat(64);
const digestB = '2'.repeat(64);

async function fixture(overrides = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'vercel-fresh-receipt-'));
  const reconciliation = overrides.reconciliation ?? {
    verified: true,
    target_commit_sha: commit,
    provider_ceiling_ambiguous: false,
    reasons: []
  };
  const primary = overrides.primary ?? {
    commit_sha: commit,
    canonical_sha256: digestA,
    method: 'github-rest-link-pagination',
    authority: 'api.github.com',
    request_id: 'primary-1',
    retrieved_at: '2026-07-13T14:29:00Z'
  };
  const independent = overrides.independent ?? {
    commit_sha: commit,
    canonical_sha256: digestB,
    method: 'gh-api-paginate-slurp',
    authority: 'api.github.com',
    request_id: 'independent-1',
    retrieved_at: '2026-07-13T14:30:00Z'
  };
  const paths = {
    reconciliation_path: join(dir, 'reconciliation.json'),
    primary_observation_path: join(dir, 'primary.json'),
    independent_observation_path: join(dir, 'independent.json')
  };
  await Promise.all([
    writeFile(paths.reconciliation_path, JSON.stringify(reconciliation)),
    writeFile(paths.primary_observation_path, JSON.stringify(primary)),
    writeFile(paths.independent_observation_path, JSON.stringify(independent))
  ]);
  return { dir, paths };
}

function request(paths) {
  return {
    ...paths,
    target_commit_sha: commit,
    target_commit_time: '2026-07-13T14:20:00Z',
    evaluated_at: '2026-07-13T14:33:00Z',
    max_observation_age_ms: 10 * 60 * 1000,
    max_channel_skew_ms: 2 * 60 * 1000
  };
}

test('builds an accepted receipt while preserving the deployment claim ceiling', async () => {
  const { paths } = await fixture();
  const receipt = await buildFreshEvidenceReceipt(request(paths));
  assert.equal(receipt.assessment.accepted, true);
  assert.equal(receipt.deployment_claim_permitted, false);
  assert.equal(receipt.application_deployment_attempted, false);
  assert.equal(receipt.next_gate, 'commit-bound workflow outcome assessment');
  assert.match(receipt.source_bindings.primary_observation.sha256, /^[0-9a-f]{64}$/);
});

test('fails closed when reconciliation is not verified', async () => {
  const { paths } = await fixture({
    reconciliation: { verified: false, target_commit_sha: commit, provider_ceiling_ambiguous: false, reasons: [] }
  });
  const receipt = await buildFreshEvidenceReceipt(request(paths));
  assert.equal(receipt.assessment.accepted, false);
  assert.deepEqual(receipt.assessment.reasons, ['reconciliation_not_verified']);
  assert.equal(receipt.next_gate, 'repair rejected evidence inputs');
});

test('rejects stale retained observations', async () => {
  const { paths } = await fixture({
    primary: {
      commit_sha: commit,
      canonical_sha256: digestA,
      method: 'github-rest-link-pagination',
      authority: 'api.github.com',
      request_id: 'primary-old',
      retrieved_at: '2026-07-13T13:00:00Z'
    }
  });
  const receipt = await buildFreshEvidenceReceipt(request(paths));
  assert.equal(receipt.assessment.accepted, false);
  assert.ok(receipt.assessment.reasons.includes('primary_stale'));
});

test('writes once and refuses to overwrite retained evidence', async () => {
  const { dir, paths } = await fixture();
  const output = join(dir, 'receipt.json');
  await writeFreshEvidenceReceipt(request(paths), output);
  const written = JSON.parse(await readFile(output, 'utf8'));
  assert.equal(written.artifact_type, 'vercel-fresh-evidence-receipt');
  await assert.rejects(() => writeFreshEvidenceReceipt(request(paths), output), /EEXIST/);
});
