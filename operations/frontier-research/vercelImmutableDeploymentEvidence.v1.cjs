'use strict';

const crypto = require('node:crypto');

const SHA40 = /^[0-9a-f]{40}$/;
const DEPLOYMENT_ID = /^dpl_[A-Za-z0-9]+$/;
const HOSTNAME = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
const GENERATED_VERCEL_HOSTNAME = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.vercel\.app$/;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

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
  const observedAtMs = Date.parse(observedAt || '');

  if (!SHA40.test(expectedSha)) violations.push('expected_commit_sha_invalid');
  if (!deployment || typeof deployment !== 'object') violations.push('deployment_missing');
  if (source !== 'vercel_api_v13_get_deployment') violations.push('source_not_approved');
  if (!observedAt || Number.isNaN(observedAtMs)) violations.push('observed_at_invalid');
  if (!Number.isNaN(observedAtMs) && observedAtMs > Date.now() + MAX_CLOCK_SKEW_MS) violations.push('observed_at_in_future');

  if (deployment) {
    const deploymentUrl = String(deployment.url || '').toLowerCase();
    if (!DEPLOYMENT_ID.test(String(deployment.id || ''))) violations.push('deployment_id_invalid');
    if (!HOSTNAME.test(deploymentUrl)) violations.push('deployment_url_invalid');
    if (HOSTNAME.test(deploymentUrl) && !GENERATED_VERCEL_HOSTNAME.test(deploymentUrl)) violations.push('deployment_url_not_generated_vercel_hostname');
    if (deployment.readyState !== 'READY') violations.push('deployment_not_ready');
    if (deployment.status && deployment.status !== 'READY') violations.push('deployment_status_not_ready');
    if (deployment.deletedAt != null || deployment.softDeletedByRetention === true) violations.push('deployment_deleted_or_retained_only');
    if (!deployment.gitSource || String(deployment.gitSource.type || '').toLowerCase() !== 'github') violations.push('github_git_source_missing');
    const actualSha = String(deployment.gitSource?.sha || '').toLowerCase();
    if (!SHA40.test(actualSha)) violations.push('deployment_git_sha_invalid');
    if (SHA40.test(expectedSha) && actualSha !== expectedSha) violations.push('commit_mismatch');
    if (!deployment.projectId || !deployment.name) violations.push('project_identity_missing');

    const createdAtMs = Number(deployment.createdAt);
    if (!Number.isFinite(createdAtMs) || createdAtMs <= 0) violations.push('created_at_invalid');
    if (!Number.isNaN(observedAtMs) && Number.isFinite(createdAtMs) && createdAtMs > observedAtMs + MAX_CLOCK_SKEW_MS) {
      violations.push('deployment_created_after_observation');
    }

    if (deployment.ready != null) {
      const readyAtMs = Number(deployment.ready);
      if (!Number.isFinite(readyAtMs) || readyAtMs <= 0) violations.push('ready_at_invalid');
      if (Number.isFinite(createdAtMs) && Number.isFinite(readyAtMs) && readyAtMs < createdAtMs) violations.push('ready_before_created');
      if (!Number.isNaN(observedAtMs) && Number.isFinite(readyAtMs) && readyAtMs > observedAtMs + MAX_CLOCK_SKEW_MS) {
        violations.push('deployment_ready_after_observation');
      }
    }
  }

  const normalized = {
    schema_version: 2,
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
