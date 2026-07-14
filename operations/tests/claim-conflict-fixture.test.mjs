import test from 'node:test';
import assert from 'node:assert/strict';

import fixture from '../continuity/fixtures/CM-1029-claim-conflict-cases.json' with { type: 'json' };
import { resolveClaimConflict, validateClaimConflictFixture } from '../continuity/validate-claim-conflict-fixture.mjs';

test('CM-1029 verifies all eight cases and leaves quarantined identifiers unresolved', () => {
  const result = validateClaimConflictFixture(fixture);
  assert.equal(result.status, 'verified_fail_closed');
  assert.equal(result.verified_cases, 8);
  assert.deepEqual(result.application, {
    'M-004': 'unresolved',
    'M-005': 'unresolved',
    'M-006': 'unresolved',
  });
});

test('unknown evidentiary states fail closed', () => {
  assert.throws(
    () => resolveClaimConflict({
      case_id: 'observed_over_inferred',
      left: { evidentiary: 'rumored', immutable_locator: true },
      right: { evidentiary: 'inferred' },
    }),
    /evidentiary is unknown/,
  );
});

test('semantic similarity cannot resolve a cross-namespace collision', () => {
  const result = resolveClaimConflict(fixture.cases.find((entry) => entry.case_id === 'semantic_similarity_is_not_identity'));
  assert.deepEqual(result, {
    winner: 'none',
    action: 'reject_collision_candidate',
    resolution: 'unresolved',
  });
});

test('immutable provenance agreement resolves only its named identifier', () => {
  const result = resolveClaimConflict(fixture.cases.find((entry) => entry.case_id === 'immutable_origin_resolves_single_identifier'));
  assert.equal(result.action, 'resolve_only_M-006');
  assert.deepEqual(result.other_identifiers_unchanged, ['M-004', 'M-005']);
});

test('partial history with no matches remains absence unproven', () => {
  const result = resolveClaimConflict(fixture.cases.find((entry) => entry.case_id === 'incomplete_history_cannot_prove_unlocated'));
  assert.equal(result.classification, 'absence_unproven');
  assert.equal(result.action, 'remain_unresolved');
});
