'use strict';

const { assessCurlBoundRepertoryPublicationReadiness } = require('./assessCurlBoundRepertoryPublicationReadiness.v1.cjs');
const { assessGitHubOidcRunnerBinding } = require('../../frontier-research/githubOidcRunnerBinding.v1.cjs');

function assessOidcBoundRepertoryPublicationReadiness(input) {
  const publication = assessCurlBoundRepertoryPublicationReadiness(input);

  if (!publication.ready) {
    return {
      ...publication,
      ready: false,
      github_oidc_run_verified: false,
      violations: [...new Set([
        ...publication.violations,
        'github_oidc:publication_preconditions_rejected',
      ])].sort(),
      claim_boundary: 'publication_prohibited',
      evidence: {
        ...publication.evidence,
        github_oidc_receipt_sha256: null,
        github_oidc_run_id: null,
        github_oidc_run_attempt: null,
        github_oidc_workflow_ref: null,
        github_oidc_runner_environment: null,
      },
    };
  }

  const oidc = assessGitHubOidcRunnerBinding({
    signature_verification: input?.github_oidc_signature_verification,
    verified_oidc_claims: input?.github_oidc_verified_claims,
    expected: input?.github_oidc_expected,
  });

  if (!oidc.verified) {
    return {
      ...publication,
      ready: false,
      github_oidc_run_verified: false,
      violations: oidc.violations.map((violation) => `github_oidc:${violation}`),
      claim_boundary: 'publication_prohibited',
      evidence: {
        ...publication.evidence,
        github_oidc_receipt_sha256: null,
        github_oidc_run_id: null,
        github_oidc_run_attempt: null,
        github_oidc_workflow_ref: null,
        github_oidc_runner_environment: null,
      },
    };
  }

  const violations = [];
  if (oidc.receipt.workflow_sha !== publication.expected_commit_sha) {
    violations.push('binding:github_oidc_workflow_commit_mismatch');
  }
  if (oidc.receipt.repository !== 'MirrorCartographer/mirror-cartographer-ui') {
    violations.push('binding:github_oidc_repository_mismatch');
  }
  if (oidc.receipt.challenge_receipt_sha256 !== input?.challenge_receipt_sha256) {
    violations.push('binding:challenge_receipt_digest_mismatch');
  }
  if (oidc.receipt.capability_transcript_sha256 !== input?.capability_transcript_sha256) {
    violations.push('binding:capability_transcript_digest_mismatch');
  }
  if (oidc.receipt.hostname_transcript_sha256 !== input?.hostname_transcript_sha256) {
    violations.push('binding:hostname_transcript_digest_mismatch');
  }

  return {
    ...publication,
    ready: publication.ready && violations.length === 0,
    runtime_activation_performed: false,
    github_oidc_run_verified: true,
    violations: [...new Set(violations)].sort(),
    claim_boundary: violations.length === 0
      ? 'publication_preconditions_verified_from_exact_commit_deployment_bounded_curl_session_and_externally_verified_github_oidc_run_binding_only_runtime_activation_not_performed'
      : 'publication_prohibited',
    evidence: {
      ...publication.evidence,
      github_oidc_receipt_sha256: oidc.receipt.receipt_sha256,
      github_oidc_run_id: oidc.receipt.run_id,
      github_oidc_run_attempt: oidc.receipt.run_attempt,
      github_oidc_workflow_ref: oidc.receipt.workflow_ref,
      github_oidc_runner_environment: oidc.receipt.runner_environment,
      github_oidc_jti_sha256: oidc.receipt.jti_sha256,
      github_oidc_external_signature_verification_required: oidc.receipt.external_signature_verification_required,
      github_oidc_token_retention_required: oidc.receipt.token_retention_required,
      github_oidc_same_process_claimed: oidc.receipt.same_process_claimed,
      github_oidc_hardware_attestation_claimed: oidc.receipt.hardware_attestation_claimed,
      github_oidc_transcript_content_truth_claimed: oidc.receipt.transcript_content_truth_claimed,
      challenge_receipt_sha256: oidc.receipt.challenge_receipt_sha256,
      capability_transcript_sha256: oidc.receipt.capability_transcript_sha256,
      hostname_transcript_sha256: oidc.receipt.hostname_transcript_sha256,
    },
  };
}

module.exports = { assessOidcBoundRepertoryPublicationReadiness };
