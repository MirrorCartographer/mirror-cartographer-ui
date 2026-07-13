import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildReconciledSourceBindingPacket, run } from './vercel-source-binding-cli.mjs';

const COMMIT = 'a'.repeat(40);
const BLOB = 'b'.repeat(40);

function lookup(method, path = 'operations/evidence/example.json', blob = BLOB) {
  return {
    verification_method: method,
    path,
    blob_sha: blob,
    target_commit: COMMIT,
    verified_at: '2026-07-13T11:30:00Z'
  };
}

function binding(path = 'operations/evidence/example.json', blob = BLOB) {
  return {
    github_contents_lookup: lookup('github-contents-at-commit', path, blob),
    git_ls_tree_lookup: lookup('git-ls-tree-at-commit', path, blob)
  };
}

test('builds a receipt-ready packet only from agreeing independent bindings', () => {
  const packet = buildReconciledSourceBindingPacket({
    target_commit: COMMIT,
    bindings: [binding()]
  });
  assert.equal(packet.schema_version, 2);
  assert.equal(packet.binding_count, 1);
  assert.equal(packet.all_bindings_agreement_verified, true);
  assert.match(packet.canonical_digest_sha256, /^[0-9a-f]{64}$/);
  assert.equal(packet.deployment_claim_permitted, false);
});

test('canonicalizes binding order before digesting', () => {
  const a = buildReconciledSourceBindingPacket({
    target_commit: COMMIT,
    bindings: [binding('z.json', 'c'.repeat(40)), binding('a.json')]
  });
  const b = buildReconciledSourceBindingPacket({
    target_commit: COMMIT,
    bindings: [binding('a.json'), binding('z.json', 'c'.repeat(40))]
  });
  assert.deepEqual(a.bindings.map((entry) => entry.path), ['a.json', 'z.json']);
  assert.equal(a.canonical_digest_sha256, b.canonical_digest_sha256);
});

test('digest changes when a verified blob changes', () => {
  const a = buildReconciledSourceBindingPacket({ target_commit: COMMIT, bindings: [binding()] });
  const b = buildReconciledSourceBindingPacket({
    target_commit: COMMIT,
    bindings: [binding('operations/evidence/example.json', 'c'.repeat(40))]
  });
  assert.notEqual(a.canonical_digest_sha256, b.canonical_digest_sha256);
});

test('rejects duplicate paths', () => {
  assert.throws(
    () => buildReconciledSourceBindingPacket({ target_commit: COMMIT, bindings: [binding(), binding()] }),
    /duplicate reconciled path/
  );
});

test('rejects disagreement between source methods', () => {
  const mismatched = binding();
  mismatched.git_ls_tree_lookup.blob_sha = 'c'.repeat(40);
  assert.throws(
    () => buildReconciledSourceBindingPacket({ target_commit: COMMIT, bindings: [mismatched] }),
    /blob sha mismatch/
  );
});

test('writes once and refuses to overwrite retained output', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vercel-source-binding-'));
  const inputPath = join(dir, 'input.json');
  const outputPath = join(dir, 'output.json');
  await writeFile(inputPath, JSON.stringify({ target_commit: COMMIT, bindings: [binding()] }));

  await run([inputPath, outputPath]);
  const packet = JSON.parse(await readFile(outputPath, 'utf8'));
  assert.equal(packet.binding_count, 1);
  await assert.rejects(() => run([inputPath, outputPath]), /refusing to overwrite/);
});

test('rejects empty binding sets', () => {
  assert.throws(
    () => buildReconciledSourceBindingPacket({ target_commit: COMMIT, bindings: [] }),
    /non-empty array/
  );
});
