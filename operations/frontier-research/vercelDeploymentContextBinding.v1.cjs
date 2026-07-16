'use strict';

const crypto = require('node:crypto');
const { validateImmutableDeploymentEvidence } = require('./vercelImmutableDeploymentEvidence.v1.cjs');

const SHA40 = /^[0-9a-f]{40}$/;
const VERCEL_PROJECT_ID = /^prj_[A-Za-z0-9]+$/;
const VERCEL_TEAM_ID = /^team_[A-Za-z0-9]+$/;
const DECIMAL_ID = /^[1-9][0-9]*$/;
const PROJECT_NAME = /^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/;

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function normalizeDecimalId(value) {
  const normalized = String(value ?? '');
  return DECIMAL_ID.test(normalized) ? normalized : null;
}

function validateDeploymentContextBinding(input) {
  const base = validateImmutableDeploymentEvidence(input);
  const violations = [...base.violations];
  const deployment = input?.deployment;
  const expected = input?.expected_context || {};

  const expectedCommitSha = String(input?.expected_commit_sha || '').toLowerCase();
  const expectedProjectId = String(expected.project_id || '');
  const expectedProjectName = String(expected.project_name || '').toLowerCase();
  const expectedRepositoryId = normalizeDecimalId(expected.repository_id);
  const expectedTeamId = expected.team_id == null ? null : String(expected.team_id);

  if (!SHA40.test(expectedCommitSha)) violations.push('context_expected_commit_sha_invalid');
  if (!VERCEL_PROJECT_ID.test(expectedProjectId)) violations.push('expected_project_id_invalid');
  if (!PROJECT_NAME.test(expectedProjectName)) violations.push('expected_project_name_invalid');
  if (!expectedRepositoryId) violations.push('expected_repository_id_invalid');
  if (expectedTeamId !== null && !VERCEL_TEAM_ID.test(expectedTeamId)) violations.push('expected_team_id_invalid');

  if (deployment && typeof deployment === 'object') {
    if (String(deployment.projectId || '') !== expectedProjectId) violations.push('project_id_mismatch');
    if (String(deployment.name || '').toLowerCase() !== expectedProjectName) violations.push('project_name_mismatch');

    const actualRepositoryId = normalizeDecimalId(deployment.gitSource?.repoId);
    if (!actualRepositoryId) violations.push('deployment_repository_id_invalid');
    if (expectedRepositoryId && actualRepositoryId !== expectedRepositoryId) violations.push('repository_id_mismatch');

    if (expectedTeamId !== null) {
      const actualTeamId = String(deployment.teamId || '');
      if (!VERCEL_TEAM_ID.test(actualTeamId)) violations.push('deployment_team_id_invalid');
      if (actualTeamId !== expectedTeamId) violations.push('team_id_mismatch');
    }
  }

  const uniqueViolations = [...new Set(violations)];
  const normalized = {
    schema_version: 1,
    immutable_identity: base.normalized,
    expected_context: {
      project_id: expectedProjectId || null,
      project_name: expectedProjectName || null,
      repository_id: expectedRepositoryId,
      team_id: expectedTeamId
    },
    observed_context: deployment ? {
      project_id: deployment.projectId || null,
      project_name: deployment.name || null,
      repository_id: normalizeDecimalId(deployment.gitSource?.repoId),
      team_id: deployment.teamId || null
    } : null
  };

  return {
    verified: uniqueViolations.length === 0,
    violations: uniqueViolations,
    normalized,
    sha256: crypto.createHash('sha256').update(canonical(normalized)).digest('hex'),
    claim_boundary: uniqueViolations.length === 0
      ? 'immutable_deployment_identity_and_expected_context_verified_only'
      : 'deployment_context_unverified'
  };
}

module.exports = { validateDeploymentContextBinding };
