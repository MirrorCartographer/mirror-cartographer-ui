'use strict';

function normalized(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function assessProductionAcceptance(input) {
  const activation = input?.activation_assessment;
  const audibility = input?.audibility_assessment;
  const expectedCommit = normalized(input?.expected_commit_sha);
  const expectedDeploymentId = String(input?.expected_deployment_id || '').trim();
  const violations = [];

  if (!expectedCommit) violations.push('missing_expected_commit_sha');
  if (!expectedDeploymentId) violations.push('missing_expected_deployment_id');
  if (activation?.promotable !== true) violations.push('repertory_activation_not_promotable');
  if (normalized(activation?.expected_commit_sha) !== expectedCommit) violations.push('activation_commit_mismatch');
  if (activation?.immutable_deployment_verified !== true) violations.push('immutable_deployment_identity_unverified');
  if (activation?.claim_boundary !== 'repertory_activation_preconditions_verified_only') violations.push('activation_claim_boundary_invalid');
  if (audibility?.verified !== true) violations.push('physical_audibility_unverified');
  if (audibility?.claim !== 'physical_iPhone_Safari_audibility_confirmed_for_exact_commit_and_deployment') violations.push('audibility_claim_boundary_invalid');
  if (normalized(audibility?.tested_commit) !== expectedCommit) violations.push('audibility_commit_mismatch');
  if (String(audibility?.deployment_id || '').trim() !== expectedDeploymentId) violations.push('audibility_deployment_mismatch');
  if (!audibility?.evidence_digest) violations.push('audibility_evidence_digest_missing');

  return {
    schema_version: 1,
    accepted: violations.length === 0,
    expected_commit_sha: expectedCommit || null,
    expected_deployment_id: expectedDeploymentId || null,
    violations,
    claim_boundary: violations.length === 0
      ? 'bounded_repertory_acceptance_for_exact_commit_deployment_and_physical_device_observation'
      : 'production_acceptance_prohibited',
    evidence: {
      activation_promotable: activation?.promotable === true,
      immutable_deployment_verified: activation?.immutable_deployment_verified === true,
      physical_audibility_verified: audibility?.verified === true,
      audibility_evidence_digest: audibility?.evidence_digest || null,
    },
  };
}

module.exports = { assessProductionAcceptance };
