'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { assessRepertoryActivation } = require('./assessRepertoryActivation.v1.cjs');

const repertory = JSON.parse(readFileSync(join(__dirname, 'HOURLY_REPERTORY.v1.json'), 'utf8'));
const sha = 'a'.repeat(40);

function validDeploymentEvidence() {
  return {
    observed_at: '2026-07-15T06:51:00Z',
    source: 'vercel_api_v13_get_deployment',
    deployment: {
      id: 'dpl_ActivationEvidence1',
      url: 'mirror-cartographer-activation.example.vercel.app',
      projectId: 'prj_mirrorcartographer',
      name: 'mirror-cartographer-ui',
      readyState: 'READY',
      status: 'READY',
      createdAt: 1784098260000,
      gitSource: { type: 'github', sha, ref: 'main', repoId: 1 },
    },
  };
}

test('promotes only when canonical repertory and immutable deployment identity both verify', () => {
  const result = assessRepertoryActivation({
    repertory,
    expected_commit_sha: sha,
    deployment_evidence: validDeploymentEvidence(),
  });

  assert.equal(result.promotable, true, JSON.stringify(result.violations));
  assert.equal(result.repertory_valid, true);
  assert.equal(result.immutable_deployment_verified, true);
  assert.equal(result.claim_boundary, 'repertory_activation_preconditions_verified_only');
});

test('fails closed when deployment evidence is absent', () => {
  const result = assessRepertoryActivation({ repertory, expected_commit_sha: sha });

  assert.equal(result.promotable, false);
  assert.equal(result.immutable_deployment_verified, false);
  assert.equal(result.violations.includes('immutable_deployment_identity_unverified'), true);
  assert.equal(result.claim_boundary, 'repertory_activation_prohibited');
});

test('fails closed when deployment commit does not match the tested commit', () => {
  const evidence = validDeploymentEvidence();
  evidence.deployment.gitSource.sha = 'b'.repeat(40);

  const result = assessRepertoryActivation({
    repertory,
    expected_commit_sha: sha,
    deployment_evidence: evidence,
  });

  assert.equal(result.promotable, false);
  assert.equal(result.evidence.deployment_violations.includes('commit_mismatch'), true);
});

test('fails closed when the repertory activation boundary is weakened', () => {
  const weakened = structuredClone(repertory);
  weakened.activation_boundary.runtime_integration = 'performed';

  const result = assessRepertoryActivation({
    repertory: weakened,
    expected_commit_sha: sha,
    deployment_evidence: validDeploymentEvidence(),
  });

  assert.equal(result.promotable, false);
  assert.equal(result.violations.includes('runtime_boundary_not_fail_closed'), true);
});
