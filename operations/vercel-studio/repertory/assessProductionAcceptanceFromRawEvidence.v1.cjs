'use strict';

const { assessMobileSafariAudibilityEvidence } = require('../../frontier-research/mobileSafariAudibilityEvidence.v1.cjs');

function normalized(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function assessProductionAcceptanceFromRawEvidence(input) {
  const expectedCommit = normalized(input?.expected_commit_sha);
  const expectedDeploymentId = String(input?.expected_deployment_id || '').trim();
  const activation = input?.activation_assessment;
  const raw = input?.raw_audibility_evidence;
  const audibility = assessMobileSafariAudibilityEvidence(raw);
  const violations = [];

  if (!expectedCommit) violations.push('missing_expected_commit_sha');
  if (!expectedDeploymentId) violations.push('missing_expected_deployment_id');
  if (activation?.promotable !== true) violations.push('repertory_activation_not_promotable');
  if (normalized(activation?.expected_commit_sha) !== expectedCommit) violations.push('activation_commit_mismatch');
  if (activation?.immutable_deployment_verified !== true) violations.push('immutable_deployment_identity_unverified');
  if (activation?.claim_boundary !== 'repertory_activation_preconditions_verified_only') violations.push('activation_claim_boundary_invalid');
  if (audibility.verified !== true) violations.push('physical_audibility_unverified');
  if (normalized(raw?.tested_commit) !== expectedCommit) violations.push('audibility_commit_mismatch');
  if (String(raw?.deployment_id || '').trim() !== expectedDeploymentId) violations.push('audibility_deployment_mismatch');

  return {
    schema_version: 1,
    accepted: violations.length === 0,
    expected_commit_sha: expectedCommit || null,
    expected_deployment_id: expectedDeploymentId || null,
    violations,
    claim_boundary: violations.length === 0
      ? 'bounded_repertory_acceptance_from_raw_physical_device_evidence'
      : 'production_acceptance_prohibited',
    evidence: {
      activation_promotable: activation?.promotable === true,
      immutable_deployment_verified: activation?.immutable_deployment_verified === true,
      physical_audibility_verified: audibility.verified,
      audibility_evidence_digest: audibility.evidence_digest,
      audibility_reasons: audibility.reasons,
    },
  };
}

module.exports = { assessProductionAcceptanceFromRawEvidence };
