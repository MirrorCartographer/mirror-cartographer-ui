'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateAdversarialReviewCycle } = require('./validateAdversarialReviewCycle.v2.cjs');

function phase(checkpoint, overrides = {}) {
  return {
    schema_version: 2,
    checkpoint,
    cycle_id: 'cycle-v2-001',
    artifact_id: 'artifact-v2-001',
    claim_or_design: 'Publication cycle decisions remain semantically consistent.',
    challenge_method: 'Construct disposable in-memory contradiction fixtures.',
    evidence: ['operations/independent-creative-web/validateAdversarialReviewCycle.v2.cjs'],
    findings: [],
    repairs: checkpoint === 'post_implementation' ? ['Added prior-decision consistency validation.'] : [],
    remaining_uncertainty: checkpoint === 'verification' ? [] : ['Runtime test execution is not yet retained.'],
    rollback_route: 'Revert the v2 validator and test commits on preview.',
    robustness_verdict: checkpoint === 'post_implementation' ? 'stronger' : 'unchanged_with_bounded_uncertainty',
    next_falsifiable_step: 'Execute this Node suite at the exact preview commit.',
    publication_decision: checkpoint === 'verification' ? 'block' : undefined,
    ...overrides,
  };
}

function publishVerification() {
  return phase('verification', {
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
      observed_at: '2026-07-16T09:05:36Z',
    }],
  });
}

function cycle(phases, publicationDecision) {
  return {
    schema_version: 1,
    cycle_id: 'cycle-v2-001',
    artifact_id: 'artifact-v2-001',
    publication_decision: publicationDecision,
    phases,
  };
}

test('accepts a complete blocked cycle', () => {
  const subject = cycle([
    phase('pre_publication'),
    phase('post_implementation'),
    phase('verification'),
  ], 'block');
  assert.equal(validateAdversarialReviewCycle(subject).valid, true);
});

test('rejects publish after an explicit pre-publication block', () => {
  const subject = cycle([
    phase('pre_publication', { publication_decision: 'block' }),
    phase('post_implementation'),
    publishVerification(),
  ], 'publish');
  const result = validateAdversarialReviewCycle(subject);
  assert.equal(result.valid, false);
  assert(result.errors.includes('phase_1:publish_after_explicit_prior_block'));
});

test('rejects publish after an explicit post-implementation block', () => {
  const subject = cycle([
    phase('pre_publication'),
    phase('post_implementation', { publication_decision: 'block' }),
    publishVerification(),
  ], 'publish');
  const result = validateAdversarialReviewCycle(subject);
  assert.equal(result.valid, false);
  assert(result.errors.includes('phase_2:publish_after_explicit_prior_block'));
});

test('does not reinterpret a prior block when final verification remains blocked', () => {
  const subject = cycle([
    phase('pre_publication', { publication_decision: 'block' }),
    phase('post_implementation'),
    phase('verification'),
  ], 'block');
  assert.equal(validateAdversarialReviewCycle(subject).valid, true);
});
