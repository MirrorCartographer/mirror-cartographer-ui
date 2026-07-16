'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateAdversarialCycle } = require('./validateAdversarialCycle.v3.cjs');

function phase(checkpoint, overrides = {}) {
  const verification = checkpoint === 'verification';
  return {
    schema_version: 4,
    checkpoint,
    target: 'continuity transition-integrity enforcement',
    attacks: ['contradiction', 'architecture drift', 'weak evidence', 'counterexample construction'],
    findings: ['v2 permits orphan dispositions and resolved uncertainty that remains active'],
    repairs: ['bind every disposition to a prior uncertainty and require repaired or rejected uncertainty to leave the next phase'],
    remaining_uncertainty: ['canonical invocation remains unproven'],
    rollback_route: 'revert the additive v3 implementation and test commits on preview',
    claim_status_after_review: 'coverage_bounded',
    design_stronger: true,
    strength_reason: 'transition records can no longer invent or falsely close uncertainty',
    evidence_quality: 'immutable repository objects plus deterministic disposable fixtures',
    claim_boundary: 'validates source-level transition integrity, not canonical runtime invocation',
    next_falsifiable_step: 'execute this suite at the exact preview commit and retain output',
    coverage_class: 'bounded',
    ...(verification ? {
      evidence_inspected: [{
        type: 'repository_file',
        locator: 'operations/continuity-mining/validateAdversarialCycle.v3.cjs',
        claim_supported: 'cycle v3 enforces uncertainty transition integrity',
        observed_at: '2026-07-16T10:02:00Z',
        strength: 'direct',
        immutable: true
      }],
      negative_controls: ['orphan disposition', 'repaired risk still active', 'rejected risk still active']
    } : {}),
    ...overrides
  };
}

function validCycle() {
  return {
    schema_version: 3,
    cycle_id: 'CM-2026-07-16-06',
    target: 'continuity transition-integrity enforcement',
    phases: [phase('pre_commit'), phase('post_implementation'), phase('verification')],
    transitions: [
      {
        from: 'pre_commit',
        to: 'post_implementation',
        uncertainty_dispositions: [{
          uncertainty: 'canonical invocation remains unproven',
          outcome: 'carried',
          evidence: 'post-implementation record retains the uncertainty'
        }]
      },
      {
        from: 'post_implementation',
        to: 'verification',
        uncertainty_dispositions: [{
          uncertainty: 'canonical invocation remains unproven',
          outcome: 'carried',
          evidence: 'verification record retains the uncertainty'
        }]
      }
    ],
    strongest_surviving_claim: 'A cycle transition must account only for prior uncertainty and cannot falsely close an active risk.',
    rejected_alternatives: ['trust arbitrary disposition entries', 'replace v2 destructively'],
    unresolved_risks: ['canonical command integration is not established'],
    rollback_route: 'revert the additive v3 implementation and test commits on preview',
    next_falsifiable_step: 'run node --test at the exact preview head and retain output'
  };
}

test('accepts a complete cycle with a carried uncertainty', () => {
  assert.deepEqual(validateAdversarialCycle(validCycle()), { valid: true, violations: [] });
});

test('rejects a disposition for uncertainty absent from the prior phase', () => {
  const cycle = validCycle();
  cycle.transitions[1].uncertainty_dispositions.push({
    uncertainty: 'invented rollback failure',
    outcome: 'rejected',
    evidence: 'unsupported synthetic disposition'
  });
  const result = validateAdversarialCycle(cycle);
  assert.equal(result.valid, false);
  assert.ok(result.violations.some((entry) => entry.startsWith('orphan_uncertainty_disposition:post_implementation->verification')));
});

test('rejects repaired uncertainty that remains active in the next phase', () => {
  const cycle = validCycle();
  cycle.transitions[1].uncertainty_dispositions[0].outcome = 'repaired';
  cycle.phases[2].repairs.push('canonical invocation remains unproven: added a disposable adapter');
  const result = validateAdversarialCycle(cycle);
  assert.equal(result.valid, false);
  assert.ok(result.violations.some((entry) => entry.startsWith('repaired_uncertainty_still_active:post_implementation->verification')));
});

test('rejects rejected uncertainty that remains active in the next phase', () => {
  const cycle = validCycle();
  cycle.transitions[1].uncertainty_dispositions[0].outcome = 'rejected';
  const result = validateAdversarialCycle(cycle);
  assert.equal(result.valid, false);
  assert.ok(result.violations.some((entry) => entry.startsWith('rejected_uncertainty_still_active:post_implementation->verification')));
});

test('accepts a repaired uncertainty when repair is traced and the risk leaves the next phase', () => {
  const cycle = validCycle();
  cycle.transitions[1].uncertainty_dispositions[0].outcome = 'repaired';
  cycle.phases[2].repairs.push('canonical invocation remains unproven: canonical command now invokes v3');
  cycle.phases[2].remaining_uncertainty = [];
  const result = validateAdversarialCycle(cycle);
  assert.deepEqual(result, { valid: true, violations: [] });
});
