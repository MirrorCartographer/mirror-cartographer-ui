'use strict';
const crypto = require('node:crypto');
const SHA40 = /^[0-9a-f]{40}$/;
const DEPLOYMENT_ID = /^dpl_[A-Za-z0-9]+$/;
const HOSTNAME = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
function validateImmutableDeploymentEvidenceV2(input) {
  const violations = [];
  const expected = input?.expected || {};
  const deployment = input?.deployment;
  const source = input?.source;
  const observedAt = input?.observed_at;
  const expectedSha = String(expected.commit_sha || '').toLowerCase();
  const expectedProjectId = String(expected.project_id || '');
  const expectedProjectName = String(expected.project_name || '');
  const expectedRepoId = expected.repo_id == null ? '' : String(expected.repo_id);
  const expectedRef = String(expected.ref || '');
  if (!SHA40.test(expectedSha)) violations.push('expected_commit_sha_invalid');
  if (!expectedProjectId) violations.push('expected_project_id_missing');
  if (!expectedProjectName) violations.push('expected_project_name_missing');
  if (!expectedRepoId) violations.push('expected_repo_id_missing');
  if (!expectedRef) violations.push('expected_ref_missing');
  if (source !== 'vercel_api_v13_get_deployment') violations.push('source_not_approved');
  if (!observedAt || Number.isNaN(Date.parse(observedAt))) violations.push('observed_at_invalid');
  if (!deployment || typeof deployment !== 'object') violations.push('deployment_missing');
  if (deployment) {
    if (!DEPLOYMENT_ID.test(String(deployment.id || ''))) violations.push('deployment_id_invalid');
    if (!HOSTNAME.test(String(deployment.url || ''))) violations.push('deployment_url_invalid');
    if (deployment.readyState !== 'READY') violations.push('deployment_not_ready');
    if (deployment.status && deployment.status !== 'READY') violations.push('deployment_status_not_ready');
    if (deployment.deletedAt != null || deployment.softDeletedByRetention === true) violations.push('deployment_deleted_or_retained_only');
    const git = deployment.gitSource;
    if (!git || String(git.type || '').toLowerCase() !== 'github') violations.push('github_git_source_missing');
    const actualSha = String(git?.sha || '').toLowerCase();
    if (!SHA40.test(actualSha)) violations.push('deployment_git_sha_invalid');
    if (SHA40.test(expectedSha) && actualSha !== expectedSha) violations.push('commit_mismatch');
    if (String(deployment.projectId || '') !== expectedProjectId) violations.push('project_id_mismatch');
    if (String(deployment.name || '') !== expectedProjectName) violations.push('project_name_mismatch');
    if (String(git?.repoId ?? '') !== expectedRepoId) violations.push('repo_id_mismatch');
    if (String(git?.ref || '') !== expectedRef) violations.push('ref_mismatch');
    if (!Number.isFinite(Number(deployment.createdAt))) violations.push('created_at_missing');
  }
  const normalized = {
    schema_version: 2,
    expected: {
      commit_sha: expectedSha,
      project_id: expectedProjectId || null,
      project_name: expectedProjectName || null,
      repo_id: expectedRepoId || null,
      ref: expectedRef || null
    },
    observed_at: observedAt || null,
    source: source || null,
    deployment: deployment ? {
      id: deployment.id || null,
      url: deployment.url || null,
      projectId: deployment.projectId || null,
      name: deployment.name || null,
      readyState: deployment.readyState || null,
      status: deployment.status || null,
      target: deployment.target ?? null,
      createdAt: deployment.createdAt ?? null,
      ready: deployment.ready ?? null,
      gitSource: deployment.gitSource ? {
        type: deployment.gitSource.type || null,
        repoId: deployment.gitSource.repoId ?? null,
        ref: deployment.gitSource.ref || null,
        sha: deployment.gitSource.sha || null,
        prId: deployment.gitSource.prId ?? null
      } : null
    } : null
  };
  return {
    verified: violations.length === 0,
    violations,
    normalized,
    sha256: crypto.createHash('sha256').update(canonical(normalized)).digest('hex'),
    claim_boundary: violations.length === 0 ? 'exact_project_and_commit_deployment_identity_verified_only' : 'deployment_identity_unverified'
  };
}
module.exports = { validateImmutableDeploymentEvidenceV2 };
