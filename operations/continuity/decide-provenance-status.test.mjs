import test from 'node:test';
import assert from 'node:assert/strict';
import { decideProvenanceStatus } from './decide-provenance-status.mjs';

const sha = 'a'.repeat(40);
const digest = 'b'.repeat(64);
const node = { identifier: 'M-004', namespace: 'continuity', owner: 'continuity_mining', semantic_role: 'artifact' };
const complete = {
  schema_version: 1,
  queue_item: 'M-RECONCILE-002',
  repository: 'MirrorCartographer/mirror-cartographer-ui',
  coverage_status: 'complete',
  branch_enumeration: { exhaustive: true, provider_ceiling_ambiguous: false },
  branches: [{ name: 'main', head_sha: sha }],
  traversals: [{ branch: 'main', commit_count: 1, ordered_commit_sha256: digest, method: 'git rev-list', retrieved_at: '2026-07-13T21:07:00Z' }],
  identifier_results: { 'M-004': { status: 'unlocated' } }
};

const candidate = {
  namespace: 'continuity', owner: 'continuity_mining', semantic_role: 'artifact',
  temporal_precedence: true, immutable_locator: `commit:${sha}`
};

test('promotes a unique immutable match to located', () => {
  const result = decideProvenanceStatus({ node, candidates: [candidate], coverageManifest: complete });
  assert.equal(result.status, 'located');
  assert.equal(result.immutable_locator, candidate.immutable_locator);
});

test('permits unlocated only after complete exhaustive coverage', () => {
  const result = decideProvenanceStatus({ node, candidates: [], coverageManifest: complete });
  assert.equal(result.status, 'unlocated');
  assert.equal(result.claim_status, 'inferred');
});

test('keeps absence unresolved under bounded coverage', () => {
  const bounded = structuredClone(complete);
  bounded.coverage_status = 'bounded';
  bounded.branch_enumeration.exhaustive = false;
  const result = decideProvenanceStatus({ node, candidates: [], coverageManifest: bounded });
  assert.equal(result.status, 'unresolved');
});

test('rejects multiple immutable matches as a collision', () => {
  const other = { ...candidate, immutable_locator: `commit:${'c'.repeat(40)}` };
  const result = decideProvenanceStatus({ node, candidates: [candidate, other], coverageManifest: complete });
  assert.equal(result.status, 'collision_rejected');
});
