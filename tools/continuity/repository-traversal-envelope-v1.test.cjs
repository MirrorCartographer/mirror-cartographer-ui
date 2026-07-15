'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildEnvelope, validateEnvelope } = require('./repository-traversal-envelope-v1.cjs');

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);

function completeInput() {
  return {
    repository: 'MirrorCartographer/mirror-cartographer-ui',
    retrieved_at: '2026-07-15T16:08:00Z',
    default_branch: 'main',
    ref_method: 'authenticated refs API with retained pagination evidence',
    refs: [
      { name: 'main', type: 'branch', target_sha: A },
      { name: 'archive', type: 'branch', target_sha: B }
    ],
    pagination_complete: true,
    permission_scope_known: true,
    ref_blind_spots: [],
    visited_commits: [A, B],
    parent_edges: [
      { child: A, parents: [B] },
      { child: B, parents: [] }
    ],
    unvisited_reachable_count: 0,
    path_queries: ['M-004', 'M-005', 'M-006'],
    path_results: [],
    deleted_path_inspection_performed: true,
    path_blind_spots: [],
    privacy_boundary: 'Public-safe repository metadata and abstract identifiers only.'
  };
}

test('builds a deterministic terminal envelope only for complete coverage', () => {
  const first = buildEnvelope(completeInput());
  const second = buildEnvelope({ ...completeInput(), refs: [...completeInput().refs].reverse() });
  assert.equal(first.coverage_assessment.status, 'complete_accessible_history');
  assert.equal(first.coverage_assessment.terminal_provenance_allowed, true);
  assert.equal(validateEnvelope(first).canonical_digest_sha256, validateEnvelope(second).canonical_digest_sha256);
});

test('fails closed when ref pagination is incomplete', () => {
  const envelope = buildEnvelope({ ...completeInput(), pagination_complete: false });
  assert.equal(envelope.coverage_assessment.status, 'incomplete_coverage');
  assert.equal(envelope.coverage_assessment.terminal_provenance_allowed, false);
  assert.match(envelope.coverage_assessment.reasons.join(' '), /pagination/);
});

test('fails closed when permission scope is unknown', () => {
  const envelope = buildEnvelope({ ...completeInput(), permission_scope_known: false });
  assert.equal(envelope.coverage_assessment.terminal_provenance_allowed, false);
  assert.match(envelope.coverage_assessment.reasons.join(' '), /permission scope/);
});

test('fails closed when reachable commits remain unvisited', () => {
  const envelope = buildEnvelope({ ...completeInput(), unvisited_reachable_count: 1 });
  assert.equal(envelope.coverage_assessment.terminal_provenance_allowed, false);
  assert.match(envelope.coverage_assessment.reasons.join(' '), /traversal/);
});

test('fails closed when deleted-path inspection is absent', () => {
  const envelope = buildEnvelope({ ...completeInput(), deleted_path_inspection_performed: false });
  assert.equal(envelope.coverage_assessment.terminal_provenance_allowed, false);
  assert.match(envelope.coverage_assessment.reasons.join(' '), /deleted-path/);
});

test('rejects tampered traversal evidence', () => {
  const envelope = buildEnvelope(completeInput());
  envelope.commit_traversal.visited_commits.push('c'.repeat(40));
  assert.throws(() => validateEnvelope(envelope), /digest mismatch/);
});

test('conflicting coverage cannot authorize terminal provenance', () => {
  const envelope = buildEnvelope({ ...completeInput(), conflicting_coverage: true });
  assert.equal(envelope.coverage_assessment.status, 'conflicting_coverage');
  assert.equal(envelope.coverage_assessment.terminal_provenance_allowed, false);
});
