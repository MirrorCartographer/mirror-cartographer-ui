import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { verifyRetainedEvidenceManifestSet } from './verify-retained-evidence-manifest-set.mjs';

const DIGEST = 'a'.repeat(64);
const NAMES = [
  'primary-enumeration.json',
  'independent-pages.json',
  'independent-command.txt',
  'reconciliation.json',
  'evidence-bundle.json',
];

async function fixture({ reconciliationDigest = DIGEST, bundleDigest = DIGEST } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'v001-retained-'));
  const values = {
    'primary-enumeration.json': JSON.stringify({ runs: [] }),
    'independent-pages.json': JSON.stringify([]),
    'independent-command.txt': 'gh api --paginate --slurp /repos/MirrorCartographer/mirror-cartographer-ui/actions/runs',
    'reconciliation.json': JSON.stringify({ plan_binding: { digest: reconciliationDigest } }),
    'evidence-bundle.json': JSON.stringify({ plan_binding: { digest: bundleDigest } }),
  };
  for (const [name, value] of Object.entries(values)) await writeFile(join(root, name), value);
  const retained_outputs = [];
  for (const name of NAMES) {
    const bytes = await readFile(join(root, name));
    retained_outputs.push({ path: join(root, name), sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  return { root, retained_outputs };
}

async function withFixture(options, run) {
  const value = await fixture(options);
  try { await run(value); } finally { await rm(value.root, { recursive: true, force: true }); }
}

test('accepts exact byte-verified set with matching plan binding', async () => {
  await withFixture({}, async ({ root, retained_outputs }) => {
    const result = await verifyRetainedEvidenceManifestSet({ retention_root: root, plan_binding_digest: DIGEST, retained_outputs });
    assert.equal(result.verified, true);
    assert.equal(result.manifest_set_verified, true);
    assert.equal(result.plan_binding_digest, DIGEST);
  });
});

test('rejects a missing required retained output', async () => {
  await withFixture({}, async ({ root, retained_outputs }) => {
    const result = await verifyRetainedEvidenceManifestSet({ retention_root: root, plan_binding_digest: DIGEST, retained_outputs: retained_outputs.slice(1) });
    assert.equal(result.verified, false);
    assert.equal(result.reason, 'retained_output_set_mismatch');
  });
});

test('rejects reconciliation plan-binding mismatch', async () => {
  await withFixture({ reconciliationDigest: 'b'.repeat(64) }, async ({ root, retained_outputs }) => {
    const result = await verifyRetainedEvidenceManifestSet({ retention_root: root, plan_binding_digest: DIGEST, retained_outputs });
    assert.equal(result.verified, false);
    assert.equal(result.reason, 'reconciliation_plan_binding_mismatch');
  });
});

test('rejects byte mutation before trusting embedded binding', async () => {
  await withFixture({}, async ({ root, retained_outputs }) => {
    await writeFile(join(root, 'evidence-bundle.json'), JSON.stringify({ plan_binding: { digest: DIGEST }, mutated: true }));
    const result = await verifyRetainedEvidenceManifestSet({ retention_root: root, plan_binding_digest: DIGEST, retained_outputs });
    assert.equal(result.verified, false);
    assert.equal(result.reason, 'retained_output_byte_digest_mismatch');
  });
});
