'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateAdversarialCycle } = require('./validateAdversarialCycle.v1.cjs');

function phase(checkpoint, overrides = {}) {
  const verification = checkpoint === 'verification';
  return {
    schema_version: 3,
    checkpoint,
    target: 'M-RECONCILE-002 provenance recovery cycle',
    attacks: ['contradiction', 'namespace collision'],
    findings: ['historical identity remains coverage-bounded'],
    repairs: ['preserved unresolved status'],
    remaining_uncertainty: ['branch coverage remains bounded'],
    rollback_route: 'revert cycle validator commits on preview',
    claim_status_after_review: 'coverage_bounded',
    design_stronger: true,
    strength_reason: 'uncertainty cannot disappear between checkpoints',
    evidence_quality: 'immutable repository objects with bounded coverage',
    claim_boundary: 'validates review continuity, not historical provenance',
    next_falsifiable_step: 'complete exhaustive branch traversal',
    coverage_class: 'bounded',
    ...(verification ? {
      evidence_inspected: ['active queue', 'provenance-gap ledger'],
      negative_controls: ['same suffix in a different namespace']
    } : {}),
    ...overrides
  };
}

function validCycle(overrides = {}) {
  const phases = [phase('pre_commit'), phase('post_implementation'), phase('verification')];
  return {
    schema_version: 1,
    cycle_id: 'CM-2026-07-16-04',
    target: 'M-RECONCILE-002 provenance recovery cycle',
    phases,
    transitions: [
      {
        from: 'pre_commit',
        to: 'post_implementation',
        uncertainty_dispositions: [{
          uncertainty: 'branch coverage remains bounded',
          outcome: 'carried',
          evidence: 'post-implementation record retains bounded coverage'
        }]
      },
      {
        from: 'post_implementation',
        to: 'verification',
        uncertainty_dispositions: [{
          uncertainty: 'branch coverage remains bounded',
          outcome: 'carried',
          evidence: 'verification record retains bounded coverage'
        }]
      }
    ],
    strongest_surviving_claim: 'All three adversarial checkpoints occurred and unresolved provenance remained bounded.',
    rejected_alternatives: ['infer identity from suffix similarity'],
    unresolved_risks: ['exhaustive branch coverage is absent'],
    rollback_route: 'revert cycle validator commits on preview',
    next_falsifiable_step: 'run exhaustive branch and commit-history traversal',
    ...overrides
  };
}

test('accepts a complete ordered cycle with uncertainty carried forward', () => {
  assert.deepEqual(validateAdversarialCycle(validCycle()), { valid: true, violations: [] });
});

test('rejects a cycle missing the post-implementation checkpoint', () => {
  const cycle = validCycle();
  cycle.phases.splice(1, 1);
  const result = validateAdversarialCycle(cycle);
  assert.equal(result.valid, false);
  assert.ok(result.violations.includes('cycle_requires_exactly_three_phases'));
});

test('rejects checkpoints in the wrong order', () => {
  const cycle = validCycle();
  [cycle.phases[0], cycle.phases[1]] = [cycle.phases[1], cycle.phases[0]];
  const result = validateAdversarialCycle(cycle);
  assert.equal(result.valid, false);
  assert.ok(result.violations.includes('phase_0:checkpoint_out_of_order'));
});

test('rejects target drift between checkpoints', () => {
  const cycle = validCycle();
  cycle.phases[2].target = 'different historical claim';
  const result = validateAdversarialCycle(cycle);
  assert.equal(result.valid, false);
  assert.ok(result.violations.includes('phase_2:target_mismatch'));
});

test('rejects silently dropped uncertainty', () => {
  const cycle = validCycle();
  cycle.transitions[1].uncertainty_dispositions = [];
  const result = validateAdversarialCycle(cycle);
  assert.equal(result.valid, false);
  assert.ok(result.violations.some((entry) => entry.startsWith('unaccounted_prior_uncertainty:post_implementation->verification')));
});

test('rejects a carried uncertainty absent from the next phase', () => {
  const cycle = validCycle();
  cycle.phases[2].remaining_uncertainty = ['different uncertainty'];
  const result = validateAdversarialCycle(cycle);
  assert.equal(result.valid, false);
  assert.ok(result.violations.some((entry) => entry.startsWith('carried_uncertainty_missing_from_next_phase')));
});

test('rejects a phase that fails the canonical v3 validator', () => {
  const cycle = validCycle();
  cycle.phases[2].rollback_route = 'N/A';
  const result = validateAdversarialCycle(cycle);
  assert.equal(result.valid, false);
  assert.ok(result.violations.includes('phase_2:placeholder_rollback_route'));
});
