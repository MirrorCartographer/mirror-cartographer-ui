'use strict';

const crypto = require('node:crypto');

const SHA40 = /^[0-9a-f]{40}$/;
const DEPLOYMENT_ID = /^dpl_[A-Za-z0-9]+$/;
const HOSTNAME = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function validateImmutableDeploymentEvidence(input) {
  const violations = [];
  const expectedSha = String(input?.expected_commit_sha || '').toLowerCase();
  const deployment = input?.deployment;
  const observedAt = input?.observed_at;
  const source = input?.source;

  if (!SHA40.test(expectedSha)) violations.push('expected_commit_sha_invalid');
  if (!deployment || typeof deployment !== 'object') violations.push('deployment_missing');
  if (source !== 'vercel_api_v13_get_deployment') violations.push('source_not_approved');
  if (!observedAt || Number.isNaN(Date.parse(observedAt))) violations.push('observed_at_invalid');

  if (deployment) {
    if (!DEPLOYMENT_ID.test(String(deployment.id || ''))) violations.push('deployment_id_invalid');
    if (!HOSTNAME.test(String(deployment.url || ''))) violations.push('deployment_url_invalid');
    if (deployment.readyState !== 'READY') violations.push('deployment_not_ready');
    if (deployment.status && deployment.status !== 'READY') violations.push('deployment_status_not_ready');
    if (deployment.deletedAt != null || deployment.softDeletedByRetention === true) violations.push('deployment_deleted_or_retained_only');
    if (!deployment.gitSource || String(deployment.gitSource.type || '').toLowerCase() !== 'github') violations.push('github_git_source_missing');
    const actualSha = String(deployment.gitSource?.sha || '').toLowerCase();
    if (!SHA40.test(actualSha)) violations.push('deployment_git_sha_invalid');
    if (SHA40.test(expectedSha) && actualSha !== expectedSha) violations.push('commit_mismatch');
    if (!deployment.projectId || !deployment.name) violations.push('project_identity_missing');
    if (!Number.isFinite(Number(deployment.createdAt))) violations.push('created_at_missing');
  }

  const normalized = {
    schema_version: 1,
    expected_commit_sha: expectedSha,
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
    claim_boundary: violations.length === 0
      ? 'immutable_deployment_identity_verified_only'
      : 'deployment_identity_unverified'
  };
}

module.exports = { validateImmutableDeploymentEvidence };
