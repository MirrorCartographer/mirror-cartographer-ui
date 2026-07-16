'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { assessRepertoryActivation } = require('./assessRepertoryActivation.v1.cjs');

const repertory = JSON.parse(readFileSync(join(__dirname, 'HOURLY_REPERTORY.v1.json'), 'utf8'));
const sha = 'a'.repeat(40);
const expectedContext = {
  project_id: 'prj_mirrorcartographer',
  project_name: 'mirror-cartographer-ui',
  repository_id: '1003910384',
};

function validDeploymentEvidence() {
  return {
    observed_at: '2026-07-15T06:51:00Z',
    source: 'vercel_api_v13_get_deployment',
    deployment: {
      id: 'dpl_ActivationEvidence1',
      url: 'mirror-cartographer-activation.vercel.app',
      projectId: 'prj_mirrorcartographer',
      name: 'mirror-cartographer-ui',
      readyState: 'READY',
      status: 'READY',
      createdAt: 1784098260000,
      gitSource: { type: 'github', sha, ref: 'main', repoId: 1003910384 },
    },
  };
}

function assess(overrides = {}) {
  return assessRepertoryActivation({
    repertory,
    expected_commit_sha: sha,
    expected_deployment_context: expectedContext,
    deployment_evidence: validDeploymentEvidence(),
    ...overrides,
  });
}

test('promotes only when canonical repertory and deployment context both verify', () => {
  const result = assess();

  assert.equal(result.promotable, true, JSON.stringify(result.violations));
  assert.equal(result.repertory_valid, true);
  assert.equal(result.deployment_context_verified, true);
  assert.equal(result.claim_boundary, 'repertory_activation_preconditions_and_deployment_context_verified_only');
});

test('fails closed when deployment evidence is absent', () => {
  const result = assess({ deployment_evidence: undefined });

  assert.equal(result.promotable, false);
  assert.equal(result.deployment_context_verified, false);
  assert.equal(result.violations.includes('deployment_context_binding_unverified'), true);
  assert.equal(result.claim_boundary, 'repertory_activation_prohibited');
});

test('fails closed when deployment commit does not match the tested commit', () => {
  const evidence = validDeploymentEvidence();
  evidence.deployment.gitSource.sha = 'b'.repeat(40);

  const result = assess({ deployment_evidence: evidence });

  assert.equal(result.promotable, false);
  assert.equal(result.evidence.deployment_violations.includes('commit_mismatch'), true);
});

test('fails closed when a deployment from another Vercel project is substituted', () => {
  const evidence = validDeploymentEvidence();
  evidence.deployment.projectId = 'prj_otherproject';

  const result = assess({ deployment_evidence: evidence });

  assert.equal(result.promotable, false);
  assert.equal(result.evidence.deployment_violations.includes('project_id_mismatch'), true);
});

test('fails closed when a deployment from another GitHub repository is substituted', () => {
  const evidence = validDeploymentEvidence();
  evidence.deployment.gitSource.repoId = 999999999;

  const result = assess({ deployment_evidence: evidence });

  assert.equal(result.promotable, false);
  assert.equal(result.evidence.deployment_violations.includes('repository_id_mismatch'), true);
});

test('fails closed when expected deployment context is missing', () => {
  const result = assess({ expected_deployment_context: undefined });

  assert.equal(result.promotable, false);
  assert.equal(result.evidence.deployment_violations.includes('expected_project_id_invalid'), true);
  assert.equal(result.evidence.deployment_violations.includes('expected_repository_id_invalid'), true);
});

test('fails closed when the repertory activation boundary is weakened', () => {
  const weakened = structuredClone(repertory);
  weakened.activation_boundary.runtime_integration = 'performed';

  const result = assess({ repertory: weakened });

  assert.equal(result.promotable, false);
  assert.equal(result.violations.includes('runtime_boundary_not_fail_closed'), true);
});
