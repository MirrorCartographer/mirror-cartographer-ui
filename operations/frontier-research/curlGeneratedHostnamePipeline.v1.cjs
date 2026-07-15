'use strict';

const crypto = require('node:crypto');
const { assessCurlHostnameCapabilityPreflight } = require('./curlHostnameCapabilityPreflight.v1.cjs');
const { adaptCurlGeneratedHostnameReceipt } = require('./curlGeneratedHostnameReceipt.v1.cjs');
const { canonicalize } = require('./vercelGeneratedHostnameObservation.v1.cjs');

function reject(stage, violations, capabilityAssessment = null, receiptAssessment = null) {
  return {
    verified: false,
    stage,
    violations: [...new Set(violations)].sort(),
    receipt: null,
    capability_assessment: capabilityAssessment,
    hostname_receipt_assessment: receiptAssessment,
    claim_boundary: 'curl_hostname_pipeline_rejected_no_generated_hostname_claim'
  };
}

function assessCurlGeneratedHostnamePipeline(input) {
  const capabilityAssessment = assessCurlHostnameCapabilityPreflight(input && input.capability_preflight);
  if (!capabilityAssessment.verified) {
    return reject(
      'capability_preflight',
      capabilityAssessment.violations.map((violation) => `capability:${violation}`),
      capabilityAssessment
    );
  }

  const receiptAssessment = adaptCurlGeneratedHostnameReceipt(input && input.hostname_observation);
  if (!receiptAssessment.verified) {
    return reject(
      'hostname_observation',
      receiptAssessment.violations.map((violation) => `hostname:${violation}`),
      capabilityAssessment,
      receiptAssessment
    );
  }

  const receiptBase = {
    schema_version: 1,
    source_boundary: 'curl_generated_hostname_pipeline_v1',
    capability_receipt_sha256: capabilityAssessment.receipt.receipt_sha256,
    hostname_receipt_sha256: receiptAssessment.receipt.receipt_sha256,
    expected_commit_sha: receiptAssessment.receipt.expected_commit_sha,
    deployment_id: receiptAssessment.receipt.deployment_id,
    generated_hostname: receiptAssessment.receipt.generated_hostname,
    observed_at: receiptAssessment.receipt.observed_at,
    network_transfer_performed: true,
    retained_capability_receipt_required: true,
    retained_raw_write_out_required: true,
    credentials_retained: false
  };

  return {
    verified: true,
    stage: 'complete',
    violations: [],
    receipt: {
      ...receiptBase,
      receipt_sha256: crypto.createHash('sha256').update(canonicalize(receiptBase)).digest('hex')
    },
    capability_assessment: capabilityAssessment,
    hostname_receipt_assessment: receiptAssessment,
    claim_boundary: 'curl_build_capability_and_generated_hostname_https_response_verified_only_no_content_alias_audio_browser_or_device_claims'
  };
}

module.exports = { assessCurlGeneratedHostnamePipeline };
