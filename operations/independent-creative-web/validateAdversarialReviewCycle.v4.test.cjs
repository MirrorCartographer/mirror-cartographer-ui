'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateAdversarialReviewCycle } = require('./validateAdversarialReviewCycle.v4.cjs');

function phase(checkpoint, overrides = {}) {
  return {
    schema_version: 2,
    checkpoint,
    cycle_id: 'cycle-v4-001',
    artifact_id: 'artifact-v4-001',
    claim_or_design: 'Every checkpoint retains an explicit publication-evidence inventory.',
    challenge_method: 'Construct disposable in-memory omission and malformed-value fixtures.',
    evidence: ['operations/independent-creative-web/validateAdversarialReviewCycle.v4.cjs'],
    findings: [],
    repairs: checkpoint === 'post_implementation' ? ['Required the inventory for blocked and publishing cycles.'] : [],
    remaining_uncertainty: ['Runtime execution is not retained.'],
    evidence_required_before_publication: ['Exact-commit passing Node output.'],
    rollback_route: 'Revert the v4 validator, tests, package binding, and review record on preview.',
    robustness_verdict: checkpoint === 'post_implementation' ? 'stronger' : 'unchanged_with_bounded_uncertainty',
    next_falsifiable_step: 'Execute this suite at the exact preview commit.',
    publication_decision: checkpoint === 'verification' ? 'block' : undefined,
    ...overrides,
  };
}

function blockedCycle(phases) {
  return {
    schema_version: 1,
    cycle_id: 'cycle-v4-001',
    artifact_id: 'artifact-v4-001',
    publication_decision: 'block',
    phases,
  };
}

test('accepts a blocked cycle when every checkpoint explicitly inventories required publication evidence', () => {
  const subject = blockedCycle([
    phase('pre_publication'),
    phase('post_implementation'),
    phase('verification'),
  ]);
  assert.equal(validateAdversarialReviewCycle(subject).valid, true);
});

test('accepts an explicit empty inventory on a blocked checkpoint', () => {
  const subject = blockedCycle([
    phase('pre_publication', { evidence_required_before_publication: [] }),
    phase('post_implementation'),
    phase('verification'),
  ]);
  assert.equal(validateAdversarialReviewCycle(subject).valid, true);
});

test('rejects a blocked cycle when a checkpoint omits the evidence inventory', () => {
  const pre = phase('pre_publication');
  delete pre.evidence_required_before_publication;
  const subject = blockedCycle([pre, phase('post_implementation'), phase('verification')]);
  const result = validateAdversarialReviewCycle(subject);
  assert.equal(result.valid, false);
  assert(result.errors.includes('phase_1:invalid_evidence_required_before_publication'));
});

test('rejects malformed blocked-cycle evidence inventory values', () => {
  const subject = blockedCycle([
    phase('pre_publication'),
    phase('post_implementation', { evidence_required_before_publication: [''] }),
    phase('verification'),
  ]);
  const result = validateAdversarialReviewCycle(subject);
  assert.equal(result.valid, false);
  assert(result.errors.includes('phase_2:invalid_evidence_required_before_publication'));
});

test('does not duplicate the inherited error on a publishing cycle', () => {
  const verification = phase('verification', {
    publication_decision: 'publish',
    artifact_commit: '0123456789abcdef0123456789abcdef01234567',
    critical_risks_remaining: 0,
    safe_experiments_reversed: true,
    robustness_verdict: 'stronger',
    remaining_uncertainty: [],
    evidence_required_before_publication: [],
    repairs: ['Resolved all publication blockers.'],
    commit_matched_evidence: [{
      commit_sha: '0123456789abcdef0123456789abcdef01234567',
      locator: 'operations/evidence.json',
      claim: 'Exact artifact source exists at the referenced commit.',
      observed_at: '2026-07-16T12:05:10Z',
    }],
  });
  const pre = phase('pre_publication', {
    remaining_uncertainty: [],
    evidence_required_before_publication: 'none',
    robustness_verdict: 'stronger',
    repairs: ['Resolved direction risks.'],
  });
  const post = phase('post_implementation', {
    remaining_uncertainty: [],
    evidence_required_before_publication: [],
  });
  const subject = {
    ...blockedCycle([pre, post, verification]),
    publication_decision: 'publish',
  };
  const result = validateAdversarialReviewCycle(subject);
  assert.equal(result.valid, false);
  assert.equal(result.errors.filter((error) => error === 'phase_1:invalid_evidence_required_before_publication').length, 1);
});
