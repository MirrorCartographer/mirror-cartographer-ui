import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildEvidenceSubjectManifest } from './evidence-subject-manifest.mjs';

const commit = 'a'.repeat(40);

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'evidence-subject-manifest-'));
  const one = join(dir, 'one.json');
  const two = join(dir, 'two.json');
  await writeFile(one, '{"one":1}\n');
  await writeFile(two, '{"two":2}\n');
  return { one, two };
}

const base = {
  repository: 'MirrorCartographer/mirror-cartographer-ui',
  source_commit_sha: commit,
  generated_at: '2026-07-13T14:45:20Z'
};

test('creates deterministic digest-bound subjects sorted by repository-relative name', async () => {
  const { one, two } = await fixture();
  const manifest = await buildEvidenceSubjectManifest({
    ...base,
    artifacts: [
      { name: 'operations/evidence/two.json', path: two },
      { name: 'operations/evidence/one.json', path: one }
    ]
  });
  assert.equal(manifest._type, 'https://in-toto.io/Statement/v1');
  assert.deepEqual(manifest.subject.map((item) => item.name), [
    'operations/evidence/one.json',
    'operations/evidence/two.json'
  ]);
  assert.match(manifest.subject[0].digest.sha256, /^[a-f0-9]{64}$/);
  assert.equal(manifest.predicate.claim_ceiling.includes('runtime'), true);
});

test('rejects absolute subject names because they are not portable repository identities', async () => {
  const { one } = await fixture();
  await assert.rejects(
    buildEvidenceSubjectManifest({ ...base, artifacts: [{ name: one, path: one }] }),
    /absolute_subject_path_rejected/
  );
});

test('rejects repository traversal in subject names', async () => {
  const { one } = await fixture();
  await assert.rejects(
    buildEvidenceSubjectManifest({ ...base, artifacts: [{ name: '../one.json', path: one }] }),
    /subject_path_escape_rejected/
  );
});

test('rejects duplicate subject names', async () => {
  const { one, two } = await fixture();
  await assert.rejects(
    buildEvidenceSubjectManifest({
      ...base,
      artifacts: [
        { name: 'operations/evidence/same.json', path: one },
        { name: 'operations/evidence/same.json', path: two }
      ]
    }),
    /duplicate_subject_name/
  );
});

test('rejects duplicate content under different names to prevent ambiguous evidence identity', async () => {
  const { one } = await fixture();
  await assert.rejects(
    buildEvidenceSubjectManifest({
      ...base,
      artifacts: [
        { name: 'operations/evidence/one.json', path: one },
        { name: 'operations/evidence/copy.json', path: one }
      ]
    }),
    /duplicate_subject_digest/
  );
});
