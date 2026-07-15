'use strict';

function normalizeSha(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function adaptVerifiedVercelEvidence(input) {
  const pipeline = input && input.pipeline;
  const expectedCommitSha = normalizeSha(input && input.expected_commit_sha);
  const violations = [];

  if (!pipeline || typeof pipeline !== 'object' || Array.isArray(pipeline)) violations.push('pipeline:missing_or_invalid');
  if (pipeline && pipeline.verified !== true) violations.push('pipeline:not_verified');
  if (!Array.isArray(pipeline && pipeline.violations) || pipeline.violations.length !== 0) violations.push('pipeline:violations_present');
  if (!(pipeline && pipeline.retrieval && pipeline.retrieval.verified === true)) violations.push('retrieval:not_verified');
  if (!(pipeline && pipeline.identity && pipeline.identity.verified === true)) violations.push('identity:not_verified');
  if ((pipeline && pipeline.claim_boundary) !== 'authenticated_retrieval_and_immutable_deployment_identity_verified_only') violations.push('pipeline:claim_boundary_invalid');
  if (!/^[0-9a-f]{40}$/.test(expectedCommitSha)) violations.push('expected_commit_sha:invalid');

  const normalized = pipeline && pipeline.normalized;
  const identityNormalized = pipeline && pipeline.identity && pipeline.identity.normalized;
  const deployment = identityNormalized && identityNormalized.deployment;
  if (normalizeSha(normalized && normalized.expected_commit_sha) !== expectedCommitSha) violations.push('binding:pipeline_commit_mismatch');
  if (normalizeSha(identityNormalized && identityNormalized.expected_commit_sha) !== expectedCommitSha) violations.push('binding:identity_commit_mismatch');
  if (normalizeSha(deployment && deployment.gitSource && deployment.gitSource.sha) !== expectedCommitSha) violations.push('binding:deployment_commit_mismatch');

  if (!deployment || typeof deployment.id !== 'string' || deployment.id.length === 0) violations.push('deployment:id_missing');
  if (!deployment || typeof deployment.projectId !== 'string' || deployment.projectId.length === 0) violations.push('deployment:project_id_missing');
  if (!deployment || typeof deployment.url !== 'string' || deployment.url.length === 0) violations.push('deployment:generated_hostname_missing');
  if (!identityNormalized || typeof identityNormalized.observed_at !== 'string' || Number.isNaN(Date.parse(identityNormalized.observed_at))) violations.push('deployment:observed_at_invalid');
  if (!/^[0-9a-f]{64}$/.test((pipeline && pipeline.pipeline_sha256) || '')) violations.push('pipeline:sha256_invalid');

  if (violations.length > 0) return { verified: false, violations, evidence: null, claim_boundary: 'verified_evidence_adapter_rejected' };

  return {
    verified: true,
    violations: [],
    evidence: {
      schema_version: 1,
      expected_commit_sha: expectedCommitSha,
      deployment_id: deployment.id,
      project_id: deployment.projectId,
      generated_hostname: deployment.url,
      observed_at: identityNormalized.observed_at,
      evidence_pipeline_sha256: pipeline.pipeline_sha256,
      source_boundary: 'verified_vercel_deployment_evidence_pipeline_v1'
    },
    claim_boundary: 'immutable_deployment_identity_only_no_route_alias_audio_or_device_claims'
  };
}

module.exports = { adaptVerifiedVercelEvidence };
