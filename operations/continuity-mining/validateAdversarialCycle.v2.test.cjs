'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateAdversarialCycle } = require('./validateAdversarialCycle.v2.cjs');

function phase(checkpoint, overrides = {}) {
  const verification = checkpoint === 'verification';
  return {
    schema_version: 4,
    checkpoint,
    target: 'continuity adversarial-cycle enforcement',
    attacks: ['contradiction', 'architecture drift', 'weak evidence'],
    findings: ['cycle v1 still composed phase validator v3'],
    repairs: ['bound cycle v2 to structured-evidence phase validator v4'],
    remaining_uncertainty: ['canonical invocation remains unproven'],
    rollback_route: 'revert the additive v2 implementation and test commits on preview',
    claim_status_after_review: 'coverage_bounded',
    design_stronger: true,
    strength_reason: 'cycle verification can no longer bypass structured evidence validation',
    evidence_quality: 'immutable repository objects plus locally executable deterministic fixtures',
    claim_boundary: 'validates source-level cycle composition, not canonical runtime invocation',
    next_falsifiable_step: 'execute this suite at the exact preview commit and retain output',
    coverage_class: 'bounded',
    ...(verification ? {
      evidence_inspected: [{
        type: 'repository_file',
        locator: 'operations/continuity-mining/validateAdversarialCycle.v2.cjs',
        claim_supported: 'cycle v2 composes phase validator v4',
        observed_at: '2026-07-16T09:03:00Z',
        strength: 'direct',
        immutable: true
      }],
      negative_controls: ['prose-only evidence', 'mutable unretained evidence']
    } : {}),
    ...overrides
  };
}

function validCycle(overrides = {}) {
  const phases = [phase('pre_commit'), phase('post_implementation'), phase('verification')];
  return {
    schema_version: 2,
    cycle_id: 'CM-2026-07-16-05',
    target: 'continuity adversarial-cycle enforcement',
    phases,
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
    strongest_surviving_claim: 'A complete cycle must satisfy structured phase-evidence rules.',
    rejected_alternatives: ['continue composing v3', 'replace v1 destructively'],
    unresolved_risks: ['canonical command integration is not established'],
    rollback_route: 'revert the additive v2 implementation and test commits on preview',
    next_falsifiable_step: 'run node --test at the exact preview head and retain output',
    ...overrides
  };
}

test('accepts a complete ordered v4-backed cycle', () => {
  assert.deepEqual(validateAdversarialCycle(validCycle()), { valid: true, violations: [] });
});

test('rejects verification with prose-only evidence', () => {
  const cycle = validCycle();
  cycle.phases[2].evidence_inspected = ['tests passed'];
  const result = validateAdversarialCycle(cycle);
  assert.equal(result.valid, false);
  assert.ok(result.violations.includes('phase_2:evidence_0_evidence_item_must_be_object'));
});

test('rejects verification with mutable unretained evidence', () => {
  const cycle = validCycle();
  cycle.phases[2].evidence_inspected[0].immutable = false;
  const result = validateAdversarialCycle(cycle);
  assert.equal(result.valid, false);
  assert.ok(result.violations.includes('phase_2:evidence_0_evidence_must_be_immutable_or_retained'));
});

test('rejects a cycle missing the post-implementation checkpoint', () => {
  const cycle = validCycle();
  cycle.phases.splice(1, 1);
  const result = validateAdversarialCycle(cycle);
  assert.equal(result.valid, false);
  assert.ok(result.violations.includes('cycle_requires_exactly_three_phases'));
});

test('rejects target drift between checkpoints', () => {
  const cycle = validCycle();
  cycle.phases[2].target = 'different target';
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

test('rejects a verified phase with lead-only evidence', () => {
  const cycle = validCycle();
  cycle.phases[2] = phase('verification', {
    claim_status_after_review: 'verified',
    coverage_class: 'exhaustive',
    remaining_uncertainty: [],
    evidence_inspected: [{
      type: 'repository_file',
      locator: 'disposable-fixture.json',
      claim_supported: 'fixture exists',
      observed_at: '2026-07-16T09:03:00Z',
      strength: 'lead_only',
      immutable: true
    }]
  });
  cycle.transitions[1].uncertainty_dispositions[0] = {
    uncertainty: 'canonical invocation remains unproven',
    outcome: 'rejected',
    evidence: 'negative control intentionally removes the uncertainty only to test evidence strength'
  };
  const result = validateAdversarialCycle(cycle);
  assert.equal(result.valid, false);
  assert.ok(result.violations.includes('phase_2:verified_cannot_rely_on_lead_only_evidence'));
});
