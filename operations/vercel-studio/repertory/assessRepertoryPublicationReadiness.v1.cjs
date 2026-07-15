'use strict';

const { validateDurableRepertoryProvenance } = require('./validateDurableRepertoryProvenance.v1.cjs');
const { adaptVerifiedVercelEvidence } = require('../../frontier-research/verifiedVercelEvidenceAdapter.v1.cjs');
const { assessGeneratedHostnameObservation } = require('../../frontier-research/vercelGeneratedHostnameObservation.v1.cjs');

function assessRepertoryPublicationReadiness(input) {
  const expectedCommitSha = typeof input?.expected_commit_sha === 'string'
    ? input.expected_commit_sha.trim().toLowerCase()
    : '';
  const repertory = input?.repertory;
  const provenance = validateDurableRepertoryProvenance(repertory);
  const deployment = adaptVerifiedVercelEvidence({
    pipeline: input?.verified_deployment_pipeline,
    expected_commit_sha: expectedCommitSha,
  });
  const hostname = assessGeneratedHostnameObservation({
    verified_deployment_evidence: deployment.evidence,
    observation: input?.generated_hostname_observation,
  });

  const violations = [];
  if (!provenance.valid) violations.push('repertory:provenance_invalid');
  if (provenance.activation_claimed) violations.push('repertory:activation_already_claimed');
  if (provenance.deployment_claimed) violations.push('repertory:deployment_already_claimed');
  if (repertory?.activation_boundary?.runtime_integration !== 'not_performed') {
    violations.push('repertory:runtime_boundary_not_fail_closed');
  }
  if (repertory?.global_runtime_constraints?.deployment !== 'fail_closed_until_immutable_successful_vercel_identity_is_verified') {
    violations.push('repertory:deployment_constraint_weakened');
  }
  if (!deployment.verified) violations.push('deployment:verified_pipeline_rejected');
  if (!hostname.verified) violations.push('hostname:direct_https_observation_unverified');
  if (hostname.evidence?.expected_commit_sha !== expectedCommitSha) violations.push('binding:hostname_commit_mismatch');
  if (hostname.evidence?.deployment_id !== deployment.evidence?.deployment_id) violations.push('binding:deployment_id_mismatch');
  if (hostname.evidence?.evidence_pipeline_sha256 !== deployment.evidence?.evidence_pipeline_sha256) {
    violations.push('binding:pipeline_digest_mismatch');
  }

  return {
    schema_version: 1,
    ready: violations.length === 0,
    runtime_activation_performed: false,
    expected_commit_sha: expectedCommitSha || null,
    production_count: provenance.production_count,
    repertory_valid: provenance.valid,
    immutable_deployment_verified: deployment.verified,
    generated_hostname_https_verified: hostname.verified,
    violations,
    claim_boundary: violations.length === 0
      ? 'publication_preconditions_verified_only_runtime_activation_not_performed'
      : 'publication_prohibited',
    evidence: {
      repertory_violations: provenance.violations,
      deployment_violations: deployment.violations,
      hostname_violations: hostname.violations,
      deployment_id: deployment.evidence?.deployment_id || null,
      deployment_pipeline_sha256: deployment.evidence?.evidence_pipeline_sha256 || null,
      hostname_observation_sha256: hostname.evidence?.observation_sha256 || null,
    },
  };
}

module.exports = { assessRepertoryPublicationReadiness };