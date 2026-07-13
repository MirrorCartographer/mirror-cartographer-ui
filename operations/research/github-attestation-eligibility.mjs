const VISIBILITIES = new Set(['public', 'private', 'internal']);
const PLAN_STATUSES = new Set(['verified_enterprise_cloud', 'verified_non_enterprise', 'unknown']);

function fail(reason, details = {}) {
  return {
    schema_version: 1,
    eligible: false,
    status: 'blocked',
    reason,
    details,
    claim_boundary:
      'This preflight evaluates documented GitHub artifact-attestation availability only. It does not verify an attestation, artifact bytes, workflow identity, deployment, runtime behavior, or human observation.'
  };
}

/**
 * Fail-closed eligibility preflight for GitHub artifact attestations.
 *
 * GitHub currently documents attestations as available for public repositories
 * on current plans, while private/internal repositories require Enterprise Cloud.
 * Plan evidence must be independently supplied and explicitly verified.
 */
export function assessGitHubAttestationEligibility(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return fail('invalid_input');
  }

  const { repository, visibility, plan_status: planStatus, plan_evidence: planEvidence } = input;

  if (typeof repository !== 'string' || !/^[^/\s]+\/[^/\s]+$/.test(repository)) {
    return fail('invalid_repository');
  }
  if (!VISIBILITIES.has(visibility)) {
    return fail('invalid_visibility', { visibility });
  }
  if (!PLAN_STATUSES.has(planStatus)) {
    return fail('invalid_plan_status', { plan_status: planStatus });
  }

  if (visibility === 'public') {
    return {
      schema_version: 1,
      eligible: true,
      status: 'eligible',
      reason: 'public_repository_supported_on_current_plans',
      repository,
      visibility,
      plan_status: planStatus,
      claim_boundary:
        'Eligibility does not prove that an attestation was generated, retained, cryptographically valid, or bound to the intended artifact and workflow.'
    };
  }

  if (planStatus === 'unknown') {
    return fail('enterprise_cloud_plan_unverified', { repository, visibility });
  }

  if (planStatus === 'verified_non_enterprise') {
    return fail('private_or_internal_repository_requires_enterprise_cloud', {
      repository,
      visibility
    });
  }

  if (
    !planEvidence ||
    typeof planEvidence !== 'object' ||
    planEvidence.verified !== true ||
    typeof planEvidence.source !== 'string' ||
    planEvidence.source.trim() === '' ||
    typeof planEvidence.observed_at !== 'string' ||
    Number.isNaN(Date.parse(planEvidence.observed_at))
  ) {
    return fail('enterprise_cloud_evidence_missing_or_invalid', { repository, visibility });
  }

  return {
    schema_version: 1,
    eligible: true,
    status: 'eligible',
    reason: 'private_or_internal_repository_with_verified_enterprise_cloud',
    repository,
    visibility,
    plan_status: planStatus,
    plan_evidence: {
      verified: true,
      source: planEvidence.source,
      observed_at: planEvidence.observed_at
    },
    claim_boundary:
      'Eligibility does not prove that an attestation was generated, retained, cryptographically valid, or bound to the intended artifact and workflow.'
  };
}
