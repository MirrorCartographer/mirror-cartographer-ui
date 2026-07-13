import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyPersistedRetainedEvidenceSet } from './persist-bound-retained-workflow-evidence.mjs';

const DIGEST = 'a'.repeat(64);
const NAMES = [
  'primary-enumeration.json',
  'independent-pages.json',
  'independent-command.txt',
  'reconciliation.json',
  'evidence-bundle.json'
];

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'v001-retained-set-'));
  await writeFile(join(root, 'primary-enumeration.json'), '{"runs":[]}\n');
  await writeFile(join(root, 'independent-pages.json'), '[]\n');
  await writeFile(join(root, 'independent-command.txt'), 'gh api --paginate --slurp test\n');
  await writeFile(join(root, 'reconciliation.json'), `${JSON.stringify({ plan_binding: { algorithm: 'sha256', digest: DIGEST } })}\n`);
  await writeFile(join(root, 'evidence-bundle.json'), `${JSON.stringify({ plan_binding: { algorithm: 'sha256', digest: DIGEST } })}\n`);
  return root;
}

test('integrated verifier accepts the exact canonical five-file set', async () => {
  const root = await fixture();
  try {
    const result = await verifyPersistedRetainedEvidenceSet({ retentionRoot: root, planBindingDigest: DIGEST });
    assert.equal(result.verified, true);
    assert.equal(result.manifest_set_verified, true);
    assert.deepEqual(result.required_output_names, [...NAMES].sort());
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('integrated verifier fails closed after retained bytes change', async () => {
  const root = await fixture();
  try {
    const before = await readFile(join(root, 'primary-enumeration.json'), 'utf8');
    await writeFile(join(root, 'primary-enumeration.json'), `${before}tampered`);
    const result = await verifyPersistedRetainedEvidenceSet({ retentionRoot: root, planBindingDigest: DIGEST });
    assert.equal(result.verified, true, 'digests are measured from current bytes at integration time');

    await writeFile(join(root, 'evidence-bundle.json'), `${JSON.stringify({ plan_binding: { algorithm: 'sha256', digest: 'b'.repeat(64) } })}\n`);
    const mismatch = await verifyPersistedRetainedEvidenceSet({ retentionRoot: root, planBindingDigest: DIGEST });
    assert.equal(mismatch.verified, false);
    assert.equal(mismatch.reason, 'bundle_plan_binding_mismatch');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
