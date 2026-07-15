'use strict';

const { validateVercelDeploymentRetrievalEnvelope, digest } = require('./vercelDeploymentRetrievalEnvelope.v1.cjs');
const { validateImmutableDeploymentEvidence } = require('./vercelImmutableDeploymentEvidence.v1.cjs');

function assessVercelDeploymentEvidencePipeline(input) {
  const retrieval = validateVercelDeploymentRetrievalEnvelope(input?.retrieval || {});
  const violations = retrieval.violations.map((value) => `retrieval:${value}`);

  if (!retrieval.verified) {
    const normalized = {
      schema_version: 1,
      expected_commit_sha: input?.expected_commit_sha || null,
      retrieval_envelope_sha256: retrieval.envelope_sha256,
      identity_sha256: null
    };

    return {
      verified: false,
      violations,
      retrieval,
      identity: null,
      normalized,
      pipeline_sha256: digest(normalized),
      claim_boundary: 'deployment_evidence_pipeline_unverified'
    };
  }

  const body = input.retrieval.response.body;
  const identity = validateImmutableDeploymentEvidence({
    expected_commit_sha: input?.expected_commit_sha,
    observed_at: input.retrieval.observed_at,
    source: 'vercel_api_v13_get_deployment',
    deployment: body
  });

  violations.push(...identity.violations.map((value) => `identity:${value}`));

  if (identity.normalized.deployment?.id !== retrieval.normalized.response.deployment_id) {
    violations.push('binding:deployment_id_mismatch');
  }
  if (identity.normalized.deployment?.projectId !== retrieval.normalized.response.project_id) {
    violations.push('binding:project_id_mismatch');
  }
  if (identity.normalized.observed_at !== retrieval.normalized.observed_at) {
    violations.push('binding:observed_at_mismatch');
  }

  const normalized = {
    schema_version: 1,
    expected_commit_sha: identity.normalized.expected_commit_sha || null,
    retrieval_envelope_sha256: retrieval.envelope_sha256,
    identity_sha256: identity.sha256
  };

  return {
    verified: violations.length === 0,
    violations,
    retrieval,
    identity,
    normalized,
    pipeline_sha256: digest(normalized),
    claim_boundary: violations.length === 0
      ? 'authenticated_retrieval_and_immutable_deployment_identity_verified_only'
      : 'deployment_evidence_pipeline_unverified'
  };
}

module.exports = { assessVercelDeploymentEvidencePipeline };
