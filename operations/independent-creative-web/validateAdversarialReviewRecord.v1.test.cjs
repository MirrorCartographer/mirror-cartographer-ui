'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateAdversarialReviewRecord } = require('./validateAdversarialReviewRecord.v1.cjs');

function validRecord(overrides = {}) {
  return {
    schema_version: 1,
    checkpoint: 'verification',
    claim_or_design: 'The preview is ready for publication.',
    challenge_method: 'Attempt to falsify deployment, accessibility, privacy, and rollback claims.',
    evidence: ['preview deployment object', 'keyboard test record'],
    findings: ['No critical contradiction survived.'],
    repairs: ['Bound deployment evidence to the exact commit.'],
    remaining_uncertainty: ['Physical-device coverage is limited.'],
    rollback_route: 'Revert commit abc123 on preview.',
    robustness_verdict: 'stronger',
    next_falsifiable_step: 'Repeat verification on a physical mobile device.',
    publication_decision: 'publish',
    critical_risks_remaining: 0,
    commit_matched_evidence: ['deployment abc123 READY'],
    safe_experiments_reversed: true,
    ...overrides,
  };
}

test('accepts a complete verification record', () => {
  assert.deepEqual(validateAdversarialReviewRecord(validRecord()), { valid: true, errors: [] });
});

test('rejects publication outside verification', () => {
  const result = validateAdversarialReviewRecord(validRecord({ checkpoint: 'post_implementation' }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('publish_only_allowed_at_verification'));
});

test('rejects publication without commit-matched evidence', () => {
  const result = validateAdversarialReviewRecord(validRecord({ commit_matched_evidence: [] }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('publish_without_commit_matched_evidence'));
});

test('rejects publication with a critical risk', () => {
  const result = validateAdversarialReviewRecord(validRecord({ critical_risks_remaining: 1 }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('publish_with_critical_risks'));
});

test('rejects unsafe intentional failure scope', () => {
  const result = validateAdversarialReviewRecord(validRecord({
    publication_decision: 'block',
    intentional_failure_experiment: {
      scope: 'production',
      reversible: true,
      isolated: true,
      restored: true,
    },
  }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('forbidden_experiment_scope'));
});

test('accepts an isolated restored fixture failure', () => {
  const result = validateAdversarialReviewRecord(validRecord({
    publication_decision: 'block',
    intentional_failure_experiment: {
      scope: 'disposable_fixture',
      reversible: true,
      isolated: true,
      restored: true,
    },
  }));
  assert.equal(result.valid, true);
});

test('rejects stronger verdict without a repair', () => {
  const result = validateAdversarialReviewRecord(validRecord({ repairs: [] }));
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('stronger_verdict_requires_repair'));
});
