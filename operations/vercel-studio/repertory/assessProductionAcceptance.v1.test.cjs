'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { assessProductionAcceptance } = require('./assessProductionAcceptance.v1.cjs');

const commit = 'a'.repeat(40);
const deploymentId = 'dpl_exact123';

function validInput() {
  return {
    expected_commit_sha: commit,
    expected_deployment_id: deploymentId,
    activation_assessment: {
      promotable: true,
      expected_commit_sha: commit,
      immutable_deployment_verified: true,
      claim_boundary: 'repertory_activation_preconditions_verified_only',
    },
    audibility_assessment: {
      verified: true,
      claim: 'physical_iPhone_Safari_audibility_confirmed_for_exact_commit_and_deployment',
      tested_commit: commit,
      deployment_id: deploymentId,
      evidence_digest: 'b'.repeat(64),
    },
  };
}

test('accepts only aligned activation, deployment, and physical audibility evidence', () => {
  const result = assessProductionAcceptance(validInput());
  assert.equal(result.accepted, true);
  assert.deepEqual(result.violations, []);
});

test('fails closed when physical audibility is unverified', () => {
  const input = validInput();
  input.audibility_assessment.verified = false;
  input.audibility_assessment.claim = 'audibility_unverified';
  const result = assessProductionAcceptance(input);
  assert.equal(result.accepted, false);
  assert.ok(result.violations.includes('physical_audibility_unverified'));
  assert.ok(result.violations.includes('audibility_claim_boundary_invalid'));
});

test('rejects commit or deployment divergence', () => {
  const input = validInput();
  input.audibility_assessment.tested_commit = 'c'.repeat(40);
  input.audibility_assessment.deployment_id = 'dpl_other';
  const result = assessProductionAcceptance(input);
  assert.equal(result.accepted, false);
  assert.ok(result.violations.includes('audibility_commit_mismatch'));
  assert.ok(result.violations.includes('audibility_deployment_mismatch'));
});

test('does not treat activation preconditions as production acceptance', () => {
  const input = validInput();
  delete input.audibility_assessment;
  const result = assessProductionAcceptance(input);
  assert.equal(result.accepted, false);
  assert.equal(result.claim_boundary, 'production_acceptance_prohibited');
});
