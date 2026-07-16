'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateAdversarialReviewCycle } = require('./validateAdversarialReviewCycle.v3.cjs');

const COMMIT = '0123456789abcdef0123456789abcdef01234567';

function phase(checkpoint, overrides = {}) {
  return {
    schema_version: 2,
    checkpoint,
    cycle_id: 'cycle-v3-001',
    artifact_id: 'artifact-v3-001',
    claim_or_design: 'Publication requires resolved uncertainty and satisfied evidence requirements.',
    challenge_method: 'Construct disposable in-memory contradiction fixtures.',
    evidence: ['operations/independent-creative-web/validateAdversarialReviewCycle.v3.cjs'],
    findings: [],
    repairs: checkpoint === 'post_implementation' ? ['Added fail-closed uncertainty and evidence-requirement checks.'] : [],
    remaining_uncertainty: [],
    evidence_required_before_publication: [],
    rollback_route: 'Revert the v3 validator, tests, and package binding on preview.',
    robustness_verdict: checkpoint === 'post_implementation' ? 'stronger' : 'unchanged_with_bounded_uncertainty',
    next_falsifiable_step: 'Execute this Node suite at the exact preview commit.',
    publication_decision: checkpoint === 'verification' ? 'block' : undefined,
    ...overrides,
  };
}

function publishVerification(overrides = {}) {
  return phase('verification', {
    publication_decision: 'publish',
    artifact_commit: COMMIT,
    critical_risks_remaining: 0,
    safe_experiments_reversed: true,
    robustness_verdict: 'stronger',
    repairs: ['Resolved all publication blockers.'],
    remaining_uncertainty: [],
    evidence_required_before_publication: [],
    commit_matched_evidence: [{
      commit_sha: COMMIT,
      locator: 'operations/evidence.json',
      claim: 'Exact artifact source exists at the referenced commit.',
      observed_at: '2026-07-16T11:05:10Z',
    }],
    ...overrides,
  });
}

function cycle(phases, publicationDecision) {
  return {
    schema_version: 1,
    cycle_id: 'cycle-v3-001',
    artifact_id: 'artifact-v3-001',
    publication_decision: publicationDecision,
    phases,
  };
}

test('accepts a complete blocked cycle with documented outstanding evidence', () => {
  const subject = cycle([
    phase('pre_publication', {
      remaining_uncertainty: ['Runtime test output is not retained.'],
      evidence_required_before_publication: ['Exact-commit passing Node output.'],
      robustness_verdict: 'unchanged_with_bounded_uncertainty',
    }),
    phase('post_implementation', {
      remaining_uncertainty: ['Canonical invocation is not proven.'],
      evidence_required_before_publication: ['Proof the publication command invokes v3 fail-closed.'],
      robustness_verdict: 'stronger',
    }),
    phase('verification', {
      remaining_uncertainty: ['Runtime verification is unavailable.'],
      evidence_required_before_publication: ['Commit-matched runtime and deployment evidence.'],
      robustness_verdict: 'unchanged_with_bounded_uncertainty',
    }),
  ], 'block');
  assert.equal(validateAdversarialReviewCycle(subject).valid, true);
});

test('accepts publication only when all checkpoints have no remaining uncertainty or evidence requirements', () => {
  const subject = cycle([
    phase('pre_publication', { robustness_verdict: 'stronger', repairs: ['Resolved direction risks.'] }),
    phase('post_implementation'),
    publishVerification(),
  ], 'publish');
  assert.equal(validateAdversarialReviewCycle(subject).valid, true);
});

test('rejects publication when benignly worded uncertainty remains', () => {
  const subject = cycle([
    phase('pre_publication', {
      remaining_uncertainty: ['Runtime invocation has not yet been observed.'],
      robustness_verdict: 'unchanged_with_bounded_uncertainty',
    }),
    phase('post_implementation'),
    publishVerification(),
  ], 'publish');
  const result = validateAdversarialReviewCycle(subject);
  assert.equal(result.valid, false);
  assert(result.errors.includes('phase_1:publish_with_remaining_uncertainty'));
});

test('rejects publication with an explicit outstanding evidence requirement', () => {
  const subject = cycle([
    phase('pre_publication', {
      evidence_required_before_publication: ['Exact-commit browser evidence.'],
      robustness_verdict: 'stronger',
      repairs: ['Refined evidence contract.'],
    }),
    phase('post_implementation'),
    publishVerification(),
  ], 'publish');
  const result = validateAdversarialReviewCycle(subject);
  assert.equal(result.valid, false);
  assert(result.errors.includes('phase_1:publish_with_outstanding_evidence_requirement'));
});

test('rejects malformed evidence requirement metadata on a publishing cycle', () => {
  const subject = cycle([
    phase('pre_publication', {
      evidence_required_before_publication: 'none',
      robustness_verdict: 'stronger',
      repairs: ['Refined evidence contract.'],
    }),
    phase('post_implementation'),
    publishVerification(),
  ], 'publish');
  const result = validateAdversarialReviewCycle(subject);
  assert.equal(result.valid, false);
  assert(result.errors.includes('phase_1:invalid_evidence_required_before_publication'));
});
