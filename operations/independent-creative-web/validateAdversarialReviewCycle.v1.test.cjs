'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateAdversarialReviewCycle } = require('./validateAdversarialReviewCycle.v1.cjs');

function phase(checkpoint, overrides = {}) {
  return {
    schema_version: 2,
    checkpoint,
    cycle_id: 'cycle-001',
    artifact_id: 'artifact-001',
    claim_or_design: 'Publication cycle is complete and fail-closed.',
    challenge_method: 'Construct reversible counterexamples and inspect evidence boundaries.',
    evidence: ['operations/independent-creative-web/ADVERSARIAL_REVIEW_PROTOCOL.md'],
    findings: [],
    repairs: checkpoint === 'post_implementation' ? ['Added cycle-level validation.'] : [],
    remaining_uncertainty: checkpoint === 'verification' ? ['Runtime tests not yet executed.'] : [],
    rollback_route: 'Revert the cycle-validator commits on preview.',
    robustness_verdict: checkpoint === 'post_implementation' ? 'stronger' : 'unchanged_with_bounded_uncertainty',
    next_falsifiable_step: 'Execute the Node test suite and retain exact output.',
    publication_decision: checkpoint === 'verification' ? 'block' : undefined,
    ...overrides,
  };
}

function validCycle() {
  return {
    schema_version: 1,
    cycle_id: 'cycle-001',
    artifact_id: 'artifact-001',
    publication_decision: 'block',
    phases: [phase('pre_publication'), phase('post_implementation'), phase('verification')],
  };
}

test('accepts a complete ordered blocked cycle', () => {
  assert.equal(validateAdversarialReviewCycle(validCycle()).valid, true);
});

test('rejects a missing post-implementation phase', () => {
  const cycle = validCycle();
  cycle.phases.splice(1, 1);
  const result = validateAdversarialReviewCycle(cycle);
  assert.equal(result.valid, false);
  assert(result.errors.includes('cycle_requires_exactly_three_phases'));
});

test('rejects reordered phases', () => {
  const cycle = validCycle();
  [cycle.phases[0], cycle.phases[1]] = [cycle.phases[1], cycle.phases[0]];
  assert(validateAdversarialReviewCycle(cycle).errors.includes('phases_out_of_order_or_missing'));
});

test('rejects duplicate checkpoints', () => {
  const cycle = validCycle();
  cycle.phases[1] = phase('pre_publication');
  assert(validateAdversarialReviewCycle(cycle).errors.includes('duplicate_checkpoint'));
});

test('rejects cross-artifact phase substitution', () => {
  const cycle = validCycle();
  cycle.phases[1].artifact_id = 'artifact-other';
  assert(validateAdversarialReviewCycle(cycle).errors.includes('phase_2:artifact_id_mismatch'));
});

test('rejects a cycle decision that contradicts verification', () => {
  const cycle = validCycle();
  cycle.publication_decision = 'publish';
  assert(validateAdversarialReviewCycle(cycle).errors.includes('cycle_decision_mismatch'));
});

test('rejects publication after a blocked prior phase', () => {
  const cycle = validCycle();
  cycle.publication_decision = 'publish';
  cycle.phases[0].robustness_verdict = 'blocked';
  cycle.phases[2] = phase('verification', {
    publication_decision: 'publish',
    artifact_commit: '0123456789abcdef0123456789abcdef01234567',
    critical_risks_remaining: 0,
    safe_experiments_reversed: true,
    robustness_verdict: 'stronger',
    repairs: ['Resolved all publication blockers.'],
    remaining_uncertainty: [],
    commit_matched_evidence: [{
      commit_sha: '0123456789abcdef0123456789abcdef01234567',
      locator: 'operations/evidence.json',
      claim: 'Exact artifact source exists at the referenced commit.',
      observed_at: '2026-07-16T08:06:28Z',
    }],
  });
  assert(validateAdversarialReviewCycle(cycle).errors.includes('publish_after_nonpassing_prior_phase'));
});
