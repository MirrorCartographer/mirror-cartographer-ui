import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRepositoryCoverageManifest } from './validate-repository-coverage-manifest.mjs';

const sha = 'a'.repeat(40);
const digest = 'b'.repeat(64);
const base = {
  schema_version: 1,
  queue_item: 'M-RECONCILE-002',
  repository: 'MirrorCartographer/mirror-cartographer-ui',
  coverage_status: 'complete',
  branch_enumeration: { exhaustive: true, provider_ceiling_ambiguous: false },
  branches: [{ name: 'main', head_sha: sha }],
  traversals: [{ branch: 'main', commit_count: 3, ordered_commit_sha256: digest, method: 'git rev-list', retrieved_at: '2026-07-13T16:43:00Z' }],
  identifier_results: {
    'M-004': { status: 'unlocated' },
    'M-005': { status: 'collision_rejected' },
    'M-006': { status: 'located', immutable_locator: 'commit:deadbeef' }
  }
};

test('accepts complete coherent coverage', () => assert.equal(validateRepositoryCoverageManifest(base).valid, true));
test('rejects unlocated conclusion under bounded coverage', () => {
  const value = structuredClone(base); value.coverage_status = 'bounded'; value.branch_enumeration.exhaustive = false;
  assert.equal(validateRepositoryCoverageManifest(value).valid, false);
});
test('rejects untraversed branch', () => {
  const value = structuredClone(base); value.branches.push({ name: 'other', head_sha: sha });
  assert.match(validateRepositoryCoverageManifest(value).errors.join('\n'), /untraversed branches/);
});
test('rejects provider ceiling ambiguity for complete coverage', () => {
  const value = structuredClone(base); value.branch_enumeration.provider_ceiling_ambiguous = true;
  assert.equal(validateRepositoryCoverageManifest(value).valid, false);
});
test('rejects located result without immutable locator', () => {
  const value = structuredClone(base); delete value.identifier_results['M-006'].immutable_locator;
  assert.equal(validateRepositoryCoverageManifest(value).valid, false);
});
