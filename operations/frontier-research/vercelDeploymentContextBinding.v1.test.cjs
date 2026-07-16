'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateDeploymentContextBinding } = require('./vercelDeploymentContextBinding.v1.cjs');

const SHA = '0123456789abcdef0123456789abcdef01234567';
const NOW = Date.now();

function validInput() {
  return {
    expected_commit_sha: SHA,
    observed_at: new Date(NOW).toISOString(),
    source: 'vercel_api_v13_get_deployment',
    expected_context: {
      project_id: 'prj_expected123',
      project_name: 'mirror-cartographer-ui',
      repository_id: '1003910384',
      team_id: 'team_expected123'
    },
    deployment: {
      id: 'dpl_Expected123',
      url: 'mirror-cartographer-ui-abc123.vercel.app',
      projectId: 'prj_expected123',
      name: 'mirror-cartographer-ui',
      teamId: 'team_expected123',
      readyState: 'READY',
      status: 'READY',
      target: 'production',
      createdAt: NOW - 60000,
      ready: NOW - 30000,
      deletedAt: null,
      softDeletedByRetention: false,
      gitSource: {
        type: 'github',
        repoId: 1003910384,
        ref: 'main',
        sha: SHA
      }
    }
  };
}

test('accepts exact immutable deployment context', () => {
  const result = validateDeploymentContextBinding(validInput());
  assert.equal(result.verified, true);
  assert.deepEqual(result.violations, []);
  assert.equal(result.claim_boundary, 'immutable_deployment_identity_and_expected_context_verified_only');
});

test('rejects repository substitution with matching commit SHA', () => {
  const input = validInput();
  input.deployment.gitSource.repoId = 999999999;
  const result = validateDeploymentContextBinding(input);
  assert.equal(result.verified, false);
  assert.ok(result.violations.includes('repository_id_mismatch'));
});

test('rejects project substitution with matching repository and commit', () => {
  const input = validInput();
  input.deployment.projectId = 'prj_other123';
  input.deployment.name = 'other-project';
  const result = validateDeploymentContextBinding(input);
  assert.equal(result.verified, false);
  assert.ok(result.violations.includes('project_id_mismatch'));
  assert.ok(result.violations.includes('project_name_mismatch'));
});

test('rejects team-scope substitution', () => {
  const input = validInput();
  input.deployment.teamId = 'team_other123';
  const result = validateDeploymentContextBinding(input);
  assert.equal(result.verified, false);
  assert.ok(result.violations.includes('team_id_mismatch'));
});

test('rejects missing expected context instead of inferring it', () => {
  const input = validInput();
  input.expected_context = {};
  const result = validateDeploymentContextBinding(input);
  assert.equal(result.verified, false);
  assert.ok(result.violations.includes('expected_project_id_invalid'));
  assert.ok(result.violations.includes('expected_project_name_invalid'));
  assert.ok(result.violations.includes('expected_repository_id_invalid'));
});

test('canonical digest is stable for equivalent input', () => {
  const first = validateDeploymentContextBinding(validInput());
  const second = validateDeploymentContextBinding(validInput());
  assert.equal(first.sha256, second.sha256);
});
