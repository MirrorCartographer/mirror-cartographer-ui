'use strict';

const crypto = require('node:crypto');
const { assessCurlGeneratedHostnamePipeline } = require('./curlGeneratedHostnamePipeline.v1.cjs');
const { canonicalize } = require('./vercelGeneratedHostnameObservation.v1.cjs');

const DEFAULT_MAX_SKEW_MS = 15 * 60 * 1000;

function reject(violations, pipelineAssessment = null) {
  return {
    verified: false,
    violations: [...new Set(violations)].sort(),
    receipt: null,
    pipeline_assessment: pipelineAssessment,
    claim_boundary: 'curl_hostname_session_rejected_no_same_session_claim'
  };
}

function assessCurlGeneratedHostnameSession(input) {
  const pipelineAssessment = assessCurlGeneratedHostnamePipeline(input);
  if (!pipelineAssessment.verified) {
    return reject(
      pipelineAssessment.violations.map((violation) => `pipeline:${violation}`),
      pipelineAssessment
    );
  }

  const violations = [];
  const capabilityObservedAt = Date.parse(
    pipelineAssessment.capability_assessment.receipt.observed_at
  );
  const hostnameObservedAt = Date.parse(
    pipelineAssessment.hostname_receipt_assessment.receipt.observed_at
  );
  const maxSkewMs = Number.isInteger(input && input.max_session_skew_ms)
    ? input.max_session_skew_ms
    : DEFAULT_MAX_SKEW_MS;

  if (maxSkewMs < 0) violations.push('session:max_skew_invalid');
  if (capabilityObservedAt > hostnameObservedAt) {
    violations.push('session:capability_observed_after_hostname');
  }

  const observedSkewMs = hostnameObservedAt - capabilityObservedAt;
  if (Number.isFinite(observedSkewMs) && observedSkewMs > maxSkewMs) {
    violations.push('session:capability_observation_too_old');
  }

  const sessionId = input && input.session_id;
  if (!(typeof sessionId === 'string' && /^[a-zA-Z0-9._:-]{8,128}$/.test(sessionId))) {
    violations.push('session:id_invalid');
  }

  if (violations.length) return reject(violations, pipelineAssessment);

  const receiptBase = {
    schema_version: 1,
    source_boundary: 'curl_generated_hostname_same_session_v1',
    session_id: sessionId,
    pipeline_receipt_sha256: pipelineAssessment.receipt.receipt_sha256,
    capability_receipt_sha256: pipelineAssessment.receipt.capability_receipt_sha256,
    hostname_receipt_sha256: pipelineAssessment.receipt.hostname_receipt_sha256,
    expected_commit_sha: pipelineAssessment.receipt.expected_commit_sha,
    deployment_id: pipelineAssessment.receipt.deployment_id,
    generated_hostname: pipelineAssessment.receipt.generated_hostname,
    capability_observed_at: new Date(capabilityObservedAt).toISOString(),
    hostname_observed_at: new Date(hostnameObservedAt).toISOString(),
    observed_skew_ms: observedSkewMs,
    maximum_session_skew_ms: maxSkewMs,
    same_process_claimed: false,
    same_bounded_session_verified: true,
    credentials_retained: false
  };

  return {
    verified: true,
    violations: [],
    receipt: {
      ...receiptBase,
      receipt_sha256: crypto.createHash('sha256').update(canonicalize(receiptBase)).digest('hex')
    },
    pipeline_assessment: pipelineAssessment,
    claim_boundary: 'curl_capability_and_generated_hostname_observation_bound_to_one_bounded_session_only_no_same_process_content_alias_audio_browser_or_device_claims'
  };
}

module.exports = {
  DEFAULT_MAX_SKEW_MS,
  assessCurlGeneratedHostnameSession
};
