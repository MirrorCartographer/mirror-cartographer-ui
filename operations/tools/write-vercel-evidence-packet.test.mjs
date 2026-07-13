import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeVercelEvidencePacket } from './write-vercel-evidence-packet.mjs';

const commit = 'a'.repeat(40);
const digestA = '1'.repeat(64);
const digestB = '2'.repeat(64);

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'vercel-evidence-packet-'));
  const reconciliation = join(dir, 'reconciliation.json');
  const primary = join(dir, 'primary.json');
  const independent = join(dir, 'independent.json');
  await Promise.all([
    writeFile(reconciliation, JSON.stringify({ verified: true, target_commit_sha: commit, provider_ceiling_ambiguous: false, reasons: [] })),
    writeFile(primary, JSON.stringify({ commit_sha: commit, canonical_sha256: digestA, method: 'github-rest-link-pagination', authority: 'api.github.com', request_id: 'primary-1', retrieved_at: '2026-07-13T14:29:00Z' })),
    writeFile(independent, JSON.stringify({ commit_sha: commit, canonical_sha256: digestB, method: 'gh-api-paginate-slurp', authority: 'api.github.com', request_id: 'independent-1', retrieved_at: '2026-07-13T14:30:00Z' }))
  ]);
  return { dir, reconciliation, primary, independent };
}

function request(paths) {
  return {
    repository: 'MirrorCartographer/mirror-cartographer-ui',
    source_commit_sha: commit,
    generated_at: '2026-07-13T14:33:00Z',
    receipt_output_path: join(paths.dir, 'receipt.json'),
    manifest_output_path: join(paths.dir, 'manifest.json'),
    receipt_request: {
      reconciliation_path: paths.reconciliation,
      primary_observation_path: paths.primary,
      independent_observation_path: paths.independent,
      target_commit_sha: commit,
      target_commit_time: '2026-07-13T14:20:00Z',
      evaluated_at: '2026-07-13T14:33:00Z',
      max_observation_age_ms: 10 * 60 * 1000,
      max_channel_skew_ms: 2 * 60 * 1000
    },
    subject_names: {
      reconciliation: 'operations/evidence/reconciliation.json',
      primary_observation: 'operations/evidence/primary.json',
      independent_observation: 'operations/evidence/independent.json',
      receipt: 'operations/evidence/receipt.json'
    }
  };
}

test('writes a receipt plus a four-subject digest manifest without raising the claim ceiling', async () => {
  const paths = await fixture();
  const result = await writeVercelEvidencePacket(request(paths));
  assert.equal(result.receipt.assessment.accepted, true);
  assert.equal(result.deployment_claim_permitted, false);
  assert.equal(result.application_deployment_attempted, false);
  assert.equal(result.manifest.subject.length, 4);
  assert.deepEqual(result.manifest.subject.map(({ name }) => name), [
    'operations/evidence/independent.json',
    'operations/evidence/primary.json',
    'operations/evidence/receipt.json',
    'operations/evidence/reconciliation.json'
  ]);
  for (const subject of result.manifest.subject) assert.match(subject.digest.sha256, /^[a-f0-9]{64}$/);

  const retainedManifest = JSON.parse(await readFile(join(paths.dir, 'manifest.json'), 'utf8'));
  assert.equal(retainedManifest.predicate.source_commit_sha, commit);
});

test('refuses to overwrite either retained output', async () => {
  const paths = await fixture();
  const first = request(paths);
  await writeVercelEvidencePacket(first);
  await assert.rejects(() => writeVercelEvidencePacket(first), /receipt_output_exists|manifest_output_exists/);
});

test('rejects absolute subject identities without leaving a partial packet', async () => {
  const paths = await fixture();
  const invalid = request(paths);
  invalid.subject_names.receipt = join(paths.dir, 'receipt.json');
  await assert.rejects(() => writeVercelEvidencePacket(invalid), /absolute_subject_path_rejected/);
  await assert.rejects(() => access(invalid.receipt_output_path), /ENOENT/);
  await assert.rejects(() => access(invalid.manifest_output_path), /ENOENT/);
});
