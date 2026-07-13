import test from 'node:test';
import assert from 'node:assert/strict';
import { computeCoverageDigest, validateCoverageEvent } from './validate-provenance-coverage-event.mjs';

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);

function fixture() {
  const event = {
    schema_version: 1,
    event_id: 'coverage-2026-07-13T0536-0400',
    owner: 'continuity_mining',
    queue_item: 'M-RECONCILE-002',
    repository: 'MirrorCartographer/mirror-cartographer-ui',
    observed_at: '2026-07-13T05:36:00-04:00',
    coverage: {
      refs: [{ name: 'refs/heads/main', tip_sha: A }],
      reachable_commits: [A, B],
      ref_inventory_complete: true,
      reachable_history_complete: true,
      pagination_complete: true,
      provider_ceiling_ambiguous: false,
      permission_errors: []
    },
    resolutions: [
      { identifier: 'M-004', status: 'unlocated', assigning_source: null, coverage_relative: true, candidates_rejected: [] },
      { identifier: 'M-005', status: 'unresolved', assigning_source: null, candidates_rejected: [] },
      { identifier: 'M-006', status: 'collision_rejected', assigning_source: null, candidates_rejected: ['V9-M-006'] }
    ]
  };
  event.coverage_digest = computeCoverageDigest(event);
  return event;
}

test('accepts exhaustive coverage-relative resolution event', () => {
  assert.equal(validateCoverageEvent(fixture()).valid, true);
});

test('rejects incomplete history before unlocated can be claimed', () => {
  const event = fixture();
  event.coverage.reachable_history_complete = false;
  event.coverage_digest = computeCoverageDigest(event);
  assert.throws(() => validateCoverageEvent(event), /reachable-history-incomplete/);
});

test('rejects provider ceiling ambiguity', () => {
  const event = fixture();
  event.coverage.provider_ceiling_ambiguous = true;
  event.coverage_digest = computeCoverageDigest(event);
  assert.throws(() => validateCoverageEvent(event), /provider-ceiling-ambiguous/);
});

test('rejects located source outside traversed graph', () => {
  const event = fixture();
  event.resolutions[0] = {
    identifier: 'M-004', status: 'located',
    assigning_source: { path: 'operations/x.json', commit_sha: 'c'.repeat(40) },
    candidates_rejected: []
  };
  event.coverage_digest = computeCoverageDigest(event);
  assert.throws(() => validateCoverageEvent(event), /assigning-commit-outside-coverage/);
});

test('rejects digest drift', () => {
  const event = fixture();
  event.coverage_digest = '0'.repeat(64);
  assert.throws(() => validateCoverageEvent(event), /coverage-digest-mismatch/);
});
