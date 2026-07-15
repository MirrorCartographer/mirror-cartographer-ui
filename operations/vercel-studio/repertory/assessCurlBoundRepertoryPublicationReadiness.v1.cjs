'use strict';

const { adaptVerifiedVercelEvidence } = require('../../frontier-research/verifiedVercelEvidenceAdapter.v1.cjs');
const { assessCurlGeneratedHostnameSession } = require('../../frontier-research/curlGeneratedHostnameSession.v1.cjs');
const { assessRepertoryPublicationReadiness } = require('./assessRepertoryPublicationReadiness.v1.cjs');

function assessCurlBoundRepertoryPublicationReadiness(input) {
  const expectedCommitSha = typeof input?.expected_commit_sha === 'string'
    ? input.expected_commit_sha.trim().toLowerCase()
    : '';

  const deployment = adaptVerifiedVercelEvidence({
    pipeline: input?.verified_deployment_pipeline,
    expected_commit_sha: expectedCommitSha,
  });

  if (!deployment.verified) {
    return {
      schema_version: 1,
      ready: false,
      runtime_activation_performed: false,
      expected_commit_sha: expectedCommitSha || null,
      curl_session_verified: false,
      curl_pipeline_verified: false,
      curl_receipt_verified: false,
      violations: ['deployment:verified_pipeline_rejected', ...deployment.violations.map((v) => `deployment:${v}`)],
      claim_boundary: 'publication_prohibited',
      evidence: {
        deployment_pipeline_sha256: deployment.evidence?.evidence_pipeline_sha256 || null,
        curl_session_sha256: null,
        curl_pipeline_sha256: null,
        curl_capability_receipt_sha256: null,
        curl_receipt_sha256: null,
        hostname_observation_sha256: null,
      },
    };
  }

  const curlSession = assessCurlGeneratedHostnameSession({
    session_id: input?.curl_session_id,
    max_session_skew_ms: input?.max_session_skew_ms,
    capability_preflight: input?.curl_capability_preflight,
    hostname_observation: {
      verified_deployment_evidence: deployment.evidence,
      command: input?.curl_command,
      curl_exit_code: input?.curl_exit_code,
      curl_write_out_json: input?.curl_write_out_json,
      observed_at: input?.observed_at,
    },
  });

  if (!curlSession.verified) {
    return {
      schema_version: 1,
      ready: false,
      runtime_activation_performed: false,
      expected_commit_sha: expectedCommitSha || null,
      curl_session_verified: false,
      curl_pipeline_verified: false,
      curl_receipt_verified: false,
      violations: curlSession.violations.map((v) => `curl_session:${v}`),
      claim_boundary: 'publication_prohibited',
      evidence: {
        deployment_pipeline_sha256: deployment.evidence.evidence_pipeline_sha256,
        curl_session_sha256: null,
        curl_pipeline_sha256: curlSession.pipeline_assessment?.receipt?.receipt_sha256 || null,
        curl_capability_receipt_sha256: curlSession.pipeline_assessment?.capability_assessment?.receipt?.receipt_sha256 || null,
        curl_receipt_sha256: curlSession.pipeline_assessment?.hostname_receipt_assessment?.receipt?.receipt_sha256 || null,
        hostname_observation_sha256: null,
      },
    };
  }

  const curlPipeline = curlSession.pipeline_assessment;
  const curl = curlPipeline.hostname_receipt_assessment;
  const metrics = curl.receipt.curl_metrics;
  const publication = assessRepertoryPublicationReadiness({
    expected_commit_sha: expectedCommitSha,
    repertory: input?.repertory,
    verified_deployment_pipeline: input?.verified_deployment_pipeline,
    generated_hostname_observation: {
      requested_url: `https://${deployment.evidence.generated_hostname}`,
      final_url: metrics.url_effective,
      method: metrics.method,
      status_code: metrics.response_code,
      redirect_count: metrics.num_redirects,
      tls_verified: metrics.ssl_verify_result === 0,
      observed_at: curl.receipt.observed_at,
      duration_ms: metrics.time_total_seconds * 1000,
      network_error: null,
    },
  });

  const violations = [...publication.violations];
  if (publication.evidence.hostname_observation_sha256 !== curl.receipt.observation_sha256) {
    violations.push('binding:curl_observation_digest_mismatch');
  }
  if (publication.evidence.deployment_pipeline_sha256 !== curl.receipt.evidence_pipeline_sha256) {
    violations.push('binding:curl_pipeline_digest_mismatch');
  }
  if (curl.receipt.expected_commit_sha !== expectedCommitSha) {
    violations.push('binding:curl_commit_mismatch');
  }
  if (curl.receipt.deployment_id !== publication.evidence.deployment_id) {
    violations.push('binding:curl_deployment_id_mismatch');
  }
  if (curlPipeline.receipt.expected_commit_sha !== expectedCommitSha) {
    violations.push('binding:curl_capability_pipeline_commit_mismatch');
  }
  if (curlPipeline.receipt.hostname_receipt_sha256 !== curl.receipt.receipt_sha256) {
    violations.push('binding:curl_hostname_receipt_digest_mismatch');
  }
  if (curlPipeline.receipt.capability_receipt_sha256 !== curlPipeline.capability_assessment.receipt.receipt_sha256) {
    violations.push('binding:curl_capability_receipt_digest_mismatch');
  }
  if (curlSession.receipt.pipeline_receipt_sha256 !== curlPipeline.receipt.receipt_sha256) {
    violations.push('binding:curl_session_pipeline_digest_mismatch');
  }
  if (curlSession.receipt.expected_commit_sha !== expectedCommitSha) {
    violations.push('binding:curl_session_commit_mismatch');
  }
  if (curlSession.receipt.deployment_id !== publication.evidence.deployment_id) {
    violations.push('binding:curl_session_deployment_id_mismatch');
  }

  return {
    ...publication,
    ready: publication.ready && violations.length === 0,
    runtime_activation_performed: false,
    curl_session_verified: true,
    curl_pipeline_verified: true,
    curl_receipt_verified: true,
    violations: [...new Set(violations)].sort(),
    claim_boundary: publication.ready && violations.length === 0
      ? 'publication_preconditions_verified_from_one_bounded_retained_curl_capability_and_hostname_session_only_runtime_activation_not_performed'
      : 'publication_prohibited',
    evidence: {
      ...publication.evidence,
      curl_session_sha256: curlSession.receipt.receipt_sha256,
      curl_session_id: curlSession.receipt.session_id,
      curl_session_observed_skew_ms: curlSession.receipt.observed_skew_ms,
      curl_session_maximum_skew_ms: curlSession.receipt.maximum_session_skew_ms,
      curl_pipeline_sha256: curlPipeline.receipt.receipt_sha256,
      curl_capability_receipt_sha256: curlPipeline.receipt.capability_receipt_sha256,
      curl_receipt_sha256: curl.receipt.receipt_sha256,
      curl_command_contract: curl.receipt.command_contract,
      retained_capability_receipt_required: curlPipeline.receipt.retained_capability_receipt_required,
      retained_raw_write_out_required: curl.receipt.retained_raw_write_out_required,
      same_process_claimed: curlSession.receipt.same_process_claimed,
      same_bounded_session_verified: curlSession.receipt.same_bounded_session_verified,
    },
  };
}

module.exports = { assessCurlBoundRepertoryPublicationReadiness };
