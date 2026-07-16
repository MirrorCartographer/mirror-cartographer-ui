'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateAdversarialPhaseRecord } = require('./validateAdversarialPhaseRecord.v1.cjs');

function validRecord(overrides = {}) {
  return {
    checkpoint: 'verification',
    target: 'M-RECONCILE-002 provenance-gap ledger',
    attacks: ['namespace collision', 'missing immutable locator'],
    findings: ['collision candidate rejected'],
    repairs: ['retained unresolved status'],
    remaining_uncertainty: ['branch coverage remains bounded'],
    rollback_route: 'revert validator commit on preview',
    claim_status_after_review: 'coverage_bounded',
    design_stronger: true,
    strength_reason: 'ambiguous provenance cannot silently become verified',
    evidence_quality: 'immutable repository objects plus bounded coverage statement',
    next_falsifiable_step: 'complete exhaustive branch traversal',
    coverage_class: 'partial',
    evidence_inspected: ['canonical queue', 'repository commits'],
    negative_controls: ['cross-namespace suffix collision'],
    claim_boundary: 'validates record completeness, not historical provenance',
    ...overrides
  };
}

test('accepts a complete coverage-bounded record', () => {
  assert.deepEqual(validateAdversarialPhaseRecord(validRecord()), {
    valid: true,
    violations: []
  });
});

test('rejects a missing rollback route', () => {
  const result = validateAdversarialPhaseRecord(validRecord({ rollback_route: '' }));
  assert.equal(result.valid, false);
  assert.ok(result.violations.includes('missing_rollback_route'));
});

test('rejects verification with partial coverage', () => {
  const result = validateAdversarialPhaseRecord(validRecord({
    claim_status_after_review: 'verified',
    coverage_class: 'partial'
  }));
  assert.equal(result.valid, false);
  assert.ok(result.violations.includes('verified_requires_exhaustive_coverage_when_coverage_claimed'));
  assert.ok(result.violations.includes('partial_coverage_cannot_verify'));
});

test('rejects verified status outside verification checkpoint', () => {
  const result = validateAdversarialPhaseRecord(validRecord({
    checkpoint: 'post_implementation',
    claim_status_after_review: 'verified',
    coverage_class: 'exhaustive'
  }));
  assert.equal(result.valid, false);
  assert.ok(result.violations.includes('verified_requires_verification_checkpoint'));
});

test('rejects unsafe intentional failure scope', () => {
  const result = validateAdversarialPhaseRecord(validRecord({
    intentional_failure_experiment: true,
    experiment_scope: 'shared_state',
    shared_state_mutated: true
  }));
  assert.equal(result.valid, false);
  assert.ok(result.violations.includes('unsafe_failure_experiment_scope'));
  assert.ok(result.violations.includes('failure_experiment_mutated_shared_state'));
});

test('accepts a safe reversible failure fixture', () => {
  const result = validateAdversarialPhaseRecord(validRecord({
    intentional_failure_experiment: true,
    experiment_scope: 'reversible_fixture',
    shared_state_mutated: false,
    automation_mutated: false,
    production_mutated: false,
    irreversible_user_data_mutated: false
  }));
  assert.equal(result.valid, true);
});
