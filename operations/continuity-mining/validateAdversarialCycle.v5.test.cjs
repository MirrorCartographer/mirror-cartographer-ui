'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateAdversarialCycle } = require('./validateAdversarialCycle.v5.cjs');

function evidence(locator, claim, strength = 'direct') {
  return {
    type: 'repository_file',
    locator,
    claim_supported: claim,
    observed_at: '2026-07-16T11:04:00Z',
    strength,
    immutable: true
  };
}

function phase(checkpoint, overrides = {}) {
  const verification = checkpoint === 'verification';
  return {
    schema_version: 4,
    checkpoint,
    target: 'continuity evidence-bound closure enforcement',
    attacks: ['contradiction', 'architecture drift', 'weak evidence', 'counterexample construction'],
    findings: ['explicit closure prose can remain ungrounded'],
    repairs: ['require closure dispositions to reference retained evidence in the next phase'],
    remaining_uncertainty: ['canonical invocation remains unproven'],
    rollback_route: 'revert the additive v5 implementation and test commits on preview',
    claim_status_after_review: 'coverage_bounded',
    design_stronger: true,
    strength_reason: 'closure claims must resolve to retained evidence with a matching supported claim',
    evidence_quality: 'immutable repository objects plus deterministic disposable fixtures',
    claim_boundary: 'validates source-level transition evidence binding, not canonical runtime invocation',
    next_falsifiable_step: 'execute this suite at the exact preview commit and retain output',
    coverage_class: 'bounded',
    ...(verification ? {
      evidence_inspected: [evidence(
        'operations/continuity-mining/validateAdversarialCycle.v5.cjs',
        'cycle v5 binds repaired and rejected uncertainty to retained evidence'
      )],
      negative_controls: ['missing evidence reference', 'unretained evidence locator', 'claim mismatch', 'lead-only evidence']
    } : {}),
    ...overrides
  };
}

function validCycle() {
  return {
    schema_version: 5,
    cycle_id: 'CM-2026-07-16-08',
    target: 'continuity evidence-bound closure enforcement',
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
    strongest_surviving_claim: 'Closure cannot be accepted solely because a disposition contains syntactically explicit prose.',
    rejected_alternatives: ['retain prose-only closure', 'duplicate phase evidence validation'],
    unresolved_risks: ['canonical command integration is not established'],
    rollback_route: 'revert the additive v5 implementation and test commits on preview',
    next_falsifiable_step: 'run node --test at the exact preview head and retain output'
  };
}

function closeInVerification(cycle, outcome, locator, claim, strength = 'direct') {
  const uncertainty = 'canonical invocation remains unproven';
  const explicit = `${outcome.toUpperCase()} ${uncertainty} :: direct canonical entrypoint inspection`;
  cycle.transitions[1].uncertainty_dispositions[0] = {
    uncertainty,
    outcome,
    evidence: explicit,
    evidence_reference_locator: locator,
    ...(outcome === 'repaired' ? { repair_reference: explicit.replace('REPAIRED', 'RESOLVED') } : {})
  };
  if (outcome === 'repaired') {
    cycle.phases[2].repairs.push(cycle.transitions[1].uncertainty_dispositions[0].repair_reference);
  }
  cycle.phases[2].remaining_uncertainty = [];
  cycle.phases[2].evidence_inspected.push(evidence(locator, claim, strength));
}

test('accepts a complete cycle with carried uncertainty', () => {
  assert.deepEqual(validateAdversarialCycle(validCycle()), { valid: true, violations: [] });
});

test('rejects repaired closure without an evidence reference', () => {
  const cycle = validCycle();
  const uncertainty = 'canonical invocation remains unproven';
  const repair = `RESOLVED ${uncertainty} :: canonical command invokes v5 fail-closed`;
  cycle.transitions[1].uncertainty_dispositions[0] = {
    uncertainty,
    outcome: 'repaired',
    evidence: 'direct implementation trace',
    repair_reference: repair
  };
  cycle.phases[2].repairs.push(repair);
  cycle.phases[2].remaining_uncertainty = [];
  const result = validateAdversarialCycle(cycle);
  assert.equal(result.valid, false);
  assert.ok(result.violations.some((entry) => entry.startsWith('closure_missing_evidence_reference:')));
});

test('rejects a closure reference absent from the next phase evidence', () => {
  const cycle = validCycle();
  closeInVerification(cycle, 'rejected', 'evidence/missing.json', 'REJECTED canonical invocation remains unproven');
  cycle.phases[2].evidence_inspected = cycle.phases[2].evidence_inspected.filter((item) => item.locator !== 'evidence/missing.json');
  const result = validateAdversarialCycle(cycle);
  assert.equal(result.valid, false);
  assert.ok(result.violations.some((entry) => entry.startsWith('closure_evidence_reference_not_in_next_phase:')));
});

test('rejects retained evidence whose supported claim does not match the closure', () => {
  const cycle = validCycle();
  closeInVerification(cycle, 'rejected', 'evidence/wrong-claim.json', 'unrelated claim');
  const result = validateAdversarialCycle(cycle);
  assert.equal(result.valid, false);
  assert.ok(result.violations.some((entry) => entry.startsWith('closure_evidence_claim_mismatch:')));
});

test('rejects lead-only evidence for uncertainty closure', () => {
  const cycle = validCycle();
  closeInVerification(cycle, 'rejected', 'evidence/lead.json', 'REJECTED canonical invocation remains unproven', 'lead_only');
  const result = validateAdversarialCycle(cycle);
  assert.equal(result.valid, false);
  assert.ok(result.violations.some((entry) => entry.startsWith('closure_cannot_rely_on_lead_only_evidence:')));
});

test('accepts repaired closure bound to matching retained evidence', () => {
  const cycle = validCycle();
  closeInVerification(cycle, 'repaired', 'evidence/canonical-entrypoint.json', 'REPAIRED canonical invocation remains unproven');
  assert.deepEqual(validateAdversarialCycle(cycle), { valid: true, violations: [] });
});

test('accepts rejected closure bound to matching retained counterevidence', () => {
  const cycle = validCycle();
  closeInVerification(cycle, 'rejected', 'evidence/counterexample.json', 'REJECTED canonical invocation remains unproven');
  assert.deepEqual(validateAdversarialCycle(cycle), { valid: true, violations: [] });
});
