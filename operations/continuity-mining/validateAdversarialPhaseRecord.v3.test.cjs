'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateAdversarialPhaseRecord } = require('./validateAdversarialPhaseRecord.v3.cjs');

function validRecord(overrides = {}) {
  return {
    schema_version: 3,
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
    claim_boundary: 'validates adversarial record integrity, not historical provenance',
    next_falsifiable_step: 'complete exhaustive branch traversal',
    coverage_class: 'bounded',
    evidence_inspected: ['canonical queue', 'repository commits'],
    negative_controls: ['cross-namespace suffix collision'],
    ...overrides
  };
}

test('accepts a complete bounded verification record', () => {
  assert.deepEqual(validateAdversarialPhaseRecord(validRecord()), { valid: true, violations: [] });
});

test('rejects verification without inspected evidence or negative controls', () => {
  const result = validateAdversarialPhaseRecord(validRecord({ evidence_inspected: [], negative_controls: [] }));
  assert.equal(result.valid, false);
  assert.ok(result.violations.includes('verification_requires_evidence'));
  assert.ok(result.violations.includes('verification_requires_negative_controls'));
});

test('rejects a placeholder rollback route', () => {
  const result = validateAdversarialPhaseRecord(validRecord({ rollback_route: 'N/A' }));
  assert.equal(result.valid, false);
  assert.ok(result.violations.includes('placeholder_rollback_route'));
});

test('rejects bounded status without bounded coverage and uncertainty', () => {
  const result = validateAdversarialPhaseRecord(validRecord({ coverage_class: 'exhaustive', remaining_uncertainty: [] }));
  assert.equal(result.valid, false);
  assert.ok(result.violations.includes('coverage_bounded_requires_partial_or_bounded_coverage'));
  assert.ok(result.violations.includes('coverage_bounded_requires_uncertainty'));
});

test('rejects missing claim boundary for a non-verified claim', () => {
  const result = validateAdversarialPhaseRecord(validRecord({ claim_boundary: '' }));
  assert.equal(result.valid, false);
  assert.ok(result.violations.includes('missing_claim_boundary'));
});

test('rejects orphan experiment fields without an intentional-failure flag', () => {
  const result = validateAdversarialPhaseRecord(validRecord({ experiment_scope: 'reversible_fixture' }));
  assert.equal(result.valid, false);
  assert.ok(result.violations.includes('experiment_fields_require_intentional_failure_flag'));
});

test('accepts a safe reversed intentional-failure fixture', () => {
  const result = validateAdversarialPhaseRecord(validRecord({
    intentional_failure_experiment: true,
    experiment_scope: 'reversible_fixture',
    experiment_reversed: true,
    experiment_evidence: 'malformed in-memory record rejected and discarded',
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
