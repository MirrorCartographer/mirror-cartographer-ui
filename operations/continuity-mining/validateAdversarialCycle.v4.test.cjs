'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateAdversarialCycle } = require('./validateAdversarialCycle.v4.cjs');

function phase(checkpoint, overrides = {}) {
  const verification = checkpoint === 'verification';
  return {
    schema_version: 4,
    checkpoint,
    target: 'continuity closure-semantics enforcement',
    attacks: ['contradiction', 'architecture drift', 'weak evidence', 'counterexample construction'],
    findings: ['substring repair traces can falsely imply closure'],
    repairs: ['require explicit exact repair references for repaired uncertainty'],
    remaining_uncertainty: ['canonical invocation remains unproven'],
    rollback_route: 'revert the additive v4 implementation and test commits on preview',
    claim_status_after_review: 'coverage_bounded',
    design_stronger: true,
    strength_reason: 'closure requires an explicit exact resolution statement rather than substring coincidence',
    evidence_quality: 'immutable repository objects plus deterministic disposable fixtures',
    claim_boundary: 'validates source-level closure semantics, not canonical runtime invocation',
    next_falsifiable_step: 'execute this suite at the exact preview commit and retain output',
    coverage_class: 'bounded',
    ...(verification ? {
      evidence_inspected: [{
        type: 'repository_file',
        locator: 'operations/continuity-mining/validateAdversarialCycle.v4.cjs',
        claim_supported: 'cycle v4 enforces explicit uncertainty closure semantics',
        observed_at: '2026-07-16T10:05:00Z',
        strength: 'direct',
        immutable: true
      }],
      negative_controls: ['negating substring repair', 'unreferenced repair', 'weak rejection evidence']
    } : {}),
    ...overrides
  };
}

function validCycle() {
  return {
    schema_version: 4,
    cycle_id: 'CM-2026-07-16-07',
    target: 'continuity closure-semantics enforcement',
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
    strongest_surviving_claim: 'A cycle cannot close uncertainty through accidental substring matching.',
    rejected_alternatives: ['retain substring repair matching', 'replace v3 destructively'],
    unresolved_risks: ['canonical command integration is not established'],
    rollback_route: 'revert the additive v4 implementation and test commits on preview',
    next_falsifiable_step: 'run node --test at the exact preview head and retain output'
  };
}

test('accepts a complete cycle with carried uncertainty', () => {
  assert.deepEqual(validateAdversarialCycle(validCycle()), { valid: true, violations: [] });
});

test('rejects negating prose that merely contains the uncertainty label', () => {
  const cycle = validCycle();
  const uncertainty = 'canonical invocation remains unproven';
  cycle.transitions[1].uncertainty_dispositions[0] = {
    uncertainty,
    outcome: 'repaired',
    evidence: 'claim appears in a repair string',
    repair_reference: `No repair exists; ${uncertainty}`
  };
  cycle.phases[2].repairs.push(`No repair exists; ${uncertainty}`);
  cycle.phases[2].remaining_uncertainty = [];
  const result = validateAdversarialCycle(cycle);
  assert.equal(result.valid, false);
  assert.ok(result.violations.some((entry) => entry.startsWith('repair_reference_not_explicit_resolution:')));
});

test('rejects a repair reference absent from the next phase', () => {
  const cycle = validCycle();
  const uncertainty = 'canonical invocation remains unproven';
  cycle.transitions[1].uncertainty_dispositions[0] = {
    uncertainty,
    outcome: 'repaired',
    evidence: 'direct implementation trace',
    repair_reference: `RESOLVED ${uncertainty} :: canonical command invokes v4`
  };
  cycle.phases[2].remaining_uncertainty = [];
  const result = validateAdversarialCycle(cycle);
  assert.equal(result.valid, false);
  assert.ok(result.violations.some((entry) => entry.startsWith('repair_reference_not_in_next_phase:')));
});

test('accepts an exact explicit repair reference retained in the next phase', () => {
  const cycle = validCycle();
  const uncertainty = 'canonical invocation remains unproven';
  const repair = `RESOLVED ${uncertainty} :: canonical command invokes v4 fail-closed`;
  cycle.transitions[1].uncertainty_dispositions[0] = {
    uncertainty,
    outcome: 'repaired',
    evidence: 'direct implementation trace',
    repair_reference: repair
  };
  cycle.phases[2].repairs.push(repair);
  cycle.phases[2].remaining_uncertainty = [];
  assert.deepEqual(validateAdversarialCycle(cycle), { valid: true, violations: [] });
});

test('rejects weak rejection evidence lacking explicit counterevidence semantics', () => {
  const cycle = validCycle();
  const uncertainty = 'canonical invocation remains unproven';
  cycle.transitions[1].uncertainty_dispositions[0] = {
    uncertainty,
    outcome: 'rejected',
    evidence: 'probably not relevant'
  };
  cycle.phases[2].remaining_uncertainty = [];
  const result = validateAdversarialCycle(cycle);
  assert.equal(result.valid, false);
  assert.ok(result.violations.some((entry) => entry.startsWith('rejection_evidence_not_explicit_counterevidence:')));
});

test('accepts explicit rejection counterevidence when the risk leaves the next phase', () => {
  const cycle = validCycle();
  const uncertainty = 'canonical invocation remains unproven';
  cycle.transitions[1].uncertainty_dispositions[0] = {
    uncertainty,
    outcome: 'rejected',
    evidence: `REJECTED ${uncertainty} :: direct canonical entrypoint inspection proves invocation`
  };
  cycle.phases[2].remaining_uncertainty = [];
  assert.deepEqual(validateAdversarialCycle(cycle), { valid: true, violations: [] });
});
