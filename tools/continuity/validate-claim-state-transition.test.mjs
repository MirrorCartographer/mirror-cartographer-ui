import test from 'node:test';
import assert from 'node:assert/strict';
import { computeTransitionDigest, validateClaimTransition } from './validate-claim-state-transition.mjs';
import { computeCoverageDigest } from './validate-provenance-coverage-event.mjs';

function base(overrides = {}) {
  const record = {
    schema_version: 1,
    transition_id: 'T-1',
    claim_id: 'M-004',
    prior_state: 'inferred',
    next_state: 'observed',
    observed_at: '2026-07-13T10:00:00Z',
    actor: 'continuity_mining',
    evidence_refs: [{ locator: 'commit:abc:path', class: 'direct_inspectable_source' }],
    reason: 'direct source located',
    privacy_class: 'internal_opaque',
    falsification_route: 'inspect immutable source',
    prior_transition_digest: null,
    coverage_digest: null,
    ...overrides
  };
  record.transition_digest = computeTransitionDigest(record);
  return record;
}

function coverage(status = 'located') {
  const event = {
    schema_version: 1,
    event_id: 'C-1',
    owner: 'continuity_mining',
    queue_item: 'M-RECONCILE-002',
    repository: 'MirrorCartographer/mirror-cartographer-ui',
    observed_at: '2026-07-13T10:00:00Z',
    coverage: {
      refs: [{ name: 'refs/heads/main', tip_sha: 'a'.repeat(40) }],
      reachable_commits: ['a'.repeat(40)],
      pagination_complete: true,
      provider_ceiling_ambiguous: false,
      permission_errors: [],
      ref_inventory_complete: true,
      reachable_history_complete: true
    },
    resolutions: [
      { identifier: 'M-004', status, assigning_source: status === 'located' ? { path: 'x', commit_sha: 'a'.repeat(40) } : null, candidates_rejected: [], coverage_relative: status === 'unlocated' },
      { identifier: 'M-005', status: 'unresolved', candidates_rejected: [] },
      { identifier: 'M-006', status: 'unresolved', candidates_rejected: [] }
    ]
  };
  event.coverage_digest = computeCoverageDigest(event);
  return event;
}

test('accepts direct-source promotion', () => assert.equal(validateClaimTransition(base()).valid, true));
test('rejects inference promoted without direct source', () => {
  const record = base({ evidence_refs: [{ locator: 'automation:1', class: 'automation_prose' }] });
  record.transition_digest = computeTransitionDigest(record);
  assert.throws(() => validateClaimTransition(record), /observed-requires-direct-source/);
});
test('rejects illegal transition', () => {
  const record = base({ prior_state: 'observed', next_state: 'located' });
  record.transition_digest = computeTransitionDigest(record);
  assert.throws(() => validateClaimTransition(record), /illegal-transition/);
});
test('rejects embedded private source text', () => {
  const record = base({ evidence_refs: [{ locator: 'chat:opaque', class: 'direct_inspectable_source', text: 'secret' }] });
  record.transition_digest = computeTransitionDigest(record);
  assert.throws(() => validateClaimTransition(record), /private-source-text-forbidden/);
});
test('requires accepted coverage for located', () => {
  const coverageEvent = coverage('located');
  const record = base({ prior_state: 'unresolved', next_state: 'located', coverage_digest: coverageEvent.coverage_digest });
  record.transition_digest = computeTransitionDigest(record);
  assert.equal(validateClaimTransition(record, { coverageEvent }).next_state, 'located');
});
test('rejects stale prior chain digest', () => {
  const record = base({ prior_transition_digest: 'old' });
  record.transition_digest = computeTransitionDigest(record);
  assert.throws(() => validateClaimTransition(record, { expectedPriorDigest: 'new' }), /prior-transition-digest-mismatch/);
});
test('rejects tampered transition digest', () => {
  const record = base();
  record.reason = 'changed';
  assert.throws(() => validateClaimTransition(record), /transition-digest-mismatch/);
});
