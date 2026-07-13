import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileExactCommitSourceBinding } from './vercel-source-binding-reconciler.mjs';

const commit = 'a'.repeat(40);
const blob = 'b'.repeat(40);
const base = {
  target_commit: commit,
  github_contents_lookup: {
    path: 'operations/tools/example.mjs',
    blob_sha: blob,
    target_commit: commit,
    verification_method: 'github-contents-at-commit',
    verified_at: '2026-07-13T10:50:00Z'
  },
  git_ls_tree_lookup: {
    path: 'operations/tools/example.mjs',
    blob_sha: blob,
    target_commit: commit,
    verification_method: 'git-ls-tree-at-commit',
    verified_at: '2026-07-13T10:50:01Z'
  }
};

test('reconciles matching independent exact-commit lookups', () => {
  const result = reconcileExactCommitSourceBinding(base);
  assert.equal(result.agreement_verified, true);
  assert.equal(result.blob_sha, blob);
  assert.equal(result.verification_method, 'reconciled-independent-exact-commit-lookups');
  assert.equal(result.verified_at, '2026-07-13T10:50:01.000Z');
  assert.equal(result.deployment_claim_permitted, false);
});

test('rejects blob disagreement', () => {
  assert.throws(() => reconcileExactCommitSourceBinding({
    ...base,
    git_ls_tree_lookup: { ...base.git_ls_tree_lookup, blob_sha: 'c'.repeat(40) }
  }), /blob sha mismatch/);
});

test('rejects path disagreement', () => {
  assert.throws(() => reconcileExactCommitSourceBinding({
    ...base,
    git_ls_tree_lookup: { ...base.git_ls_tree_lookup, path: 'operations/tools/other.mjs' }
  }), /path mismatch/);
});

test('rejects cross-commit lookup', () => {
  assert.throws(() => reconcileExactCommitSourceBinding({
    ...base,
    github_contents_lookup: { ...base.github_contents_lookup, target_commit: 'd'.repeat(40) }
  }), /target commit mismatch/);
});

test('rejects mutable or mislabeled lookup methods', () => {
  assert.throws(() => reconcileExactCommitSourceBinding({
    ...base,
    github_contents_lookup: { ...base.github_contents_lookup, verification_method: 'github-default-branch' }
  }), /verification method mismatch/);
});

test('rejects unsafe paths', () => {
  assert.throws(() => reconcileExactCommitSourceBinding({
    ...base,
    github_contents_lookup: { ...base.github_contents_lookup, path: '../secret' }
  }), /normalized/);
});
