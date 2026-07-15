'use strict';

const { validateDurableRepertoryProvenance } = require('./validateDurableRepertoryProvenance.v1.cjs');
const { validateImmutableDeploymentEvidence } = require('../../frontier-research/vercelImmutableDeploymentEvidence.v1.cjs');

function assessRepertoryActivation(input) {
  const repertory = input?.repertory;
  const deploymentEvidence = input?.deployment_evidence;
  const expectedCommitSha = String(input?.expected_commit_sha || '').toLowerCase();

  const provenance = validateDurableRepertoryProvenance(repertory);
  const deployment = validateImmutableDeploymentEvidence({
    expected_commit_sha: expectedCommitSha,
    observed_at: deploymentEvidence?.observed_at,
    source: deploymentEvidence?.source,
    deployment: deploymentEvidence?.deployment,
  });

  const violations = [];

  if (!provenance.valid) violations.push('repertory_provenance_invalid');
  if (provenance.activation_claimed) violations.push('repertory_already_claims_activation');
  if (provenance.deployment_claimed) violations.push('repertory_already_claims_deployment');
  if (repertory?.activation_boundary?.runtime_integration !== 'not_performed') {
    violations.push('runtime_boundary_not_fail_closed');
  }
  if (repertory?.global_runtime_constraints?.deployment !== 'fail_closed_until_immutable_successful_vercel_identity_is_verified') {
    violations.push('deployment_constraint_weakened');
  }
  if (!deployment.verified) violations.push('immutable_deployment_identity_unverified');

  return {
    schema_version: 1,
    promotable: violations.length === 0,
    expected_commit_sha: expectedCommitSha || null,
    production_count: provenance.production_count,
    repertory_valid: provenance.valid,
    immutable_deployment_verified: deployment.verified,
    deployment_claim_boundary: deployment.claim_boundary,
    violations,
    claim_boundary: violations.length === 0
      ? 'repertory_activation_preconditions_verified_only'
      : 'repertory_activation_prohibited',
    evidence: {
      repertory_violations: provenance.violations,
      deployment_violations: deployment.violations,
      deployment_sha256: deployment.sha256,
    },
  };
}

module.exports = { assessRepertoryActivation };
