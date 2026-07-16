'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateAdversarialPhaseRecord } = require('./validateAdversarialPhaseRecord.v2.cjs');

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
  assert.deepEqual(validateAdversarialPhaseRecord(validRecord()), { valid: true, violations: [] });
});

test('rejects a stronger verdict without a repair', () => {
  const result = validateAdversarialPhaseRecord(validRecord({ repairs: [] }));
  assert.equal(result.valid, false);
  assert.ok(result.violations.includes('stronger_verdict_requires_repair'));
});

test('rejects non-string attack entries', () => {
  const result = validateAdversarialPhaseRecord(validRecord({ attacks: ['collision', { injected: true }] }));
  assert.equal(result.valid, false);
  assert.ok(result.violations.includes('attacks_must_be_nonempty_strings'));
});

test('rejects verified status with bounded coverage or material uncertainty', () => {
  const result = validateAdversarialPhaseRecord(validRecord({
    claim_status_after_review: 'verified',
    coverage_class: 'bounded'
  }));
  assert.equal(result.valid, false);
  assert.ok(result.violations.includes('verified_requires_exhaustive_coverage'));
  assert.ok(result.violations.includes('verified_cannot_retain_material_uncertainty'));
});

test('rejects an intentional failure that was not reversed or evidenced', () => {
  const result = validateAdversarialPhaseRecord(validRecord({
    intentional_failure_experiment: true,
    experiment_scope: 'reversible_fixture',
    experiment_reversed: false,
    experiment_evidence: '',
    shared_state_mutated: false,
    automation_mutated: false,
    production_mutated: false,
    deployment_mutated: false,
    schedule_mutated: false,
    credentials_mutated: false,
    irreversible_user_data_mutated: false
  }));
  assert.equal(result.valid, false);
  assert.ok(result.violations.includes('failure_experiment_must_be_reversed'));
  assert.ok(result.violations.includes('failure_experiment_requires_evidence'));
});

test('rejects an intentional failure that mutates a protected surface', () => {
  const result = validateAdversarialPhaseRecord(validRecord({
    intentional_failure_experiment: true,
    experiment_scope: 'reversible_fixture',
    experiment_reversed: true,
    experiment_evidence: 'fixture created and removed in test memory',
    deployment_mutated: true
  }));
  assert.equal(result.valid, false);
  assert.ok(result.violations.includes('failure_experiment_mutated_deployment'));
});

test('accepts an evidenced and reversed safe failure fixture', () => {
  const result = validateAdversarialPhaseRecord(validRecord({
    intentional_failure_experiment: true,
    experiment_scope: 'reversible_fixture',
    experiment_reversed: true,
    experiment_evidence: 'in-memory malformed record rejected; fixture discarded',
    shared_state_mutated: false,
    automation_mutated: false,
    production_mutated: false,
    deployment_mutated: false,
    schedule_mutated: false,
    credentials_mutated: false,
    irreversible_user_data_mutated: false
  }));
  assert.equal(result.valid, true);
});
