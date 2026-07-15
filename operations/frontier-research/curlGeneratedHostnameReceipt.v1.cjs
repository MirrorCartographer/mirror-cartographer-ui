'use strict';

const crypto = require('node:crypto');
const { assessGeneratedHostnameObservation, canonicalize } = require('./vercelGeneratedHostnameObservation.v1.cjs');

function reject(violations) {
  return {
    verified: false,
    violations: [...new Set(violations)].sort(),
    receipt: null,
    observation_assessment: null,
    claim_boundary: 'curl_receipt_rejected_no_generated_hostname_claim'
  };
}

function normalizeUrl(value) {
  try { return new URL(value).toString(); } catch { return ''; }
}

function assessCurlCommand(command, expectedUrl) {
  const violations = [];
  if (!Array.isArray(command) || command.length < 2 || command[0] !== 'curl') return ['command:invalid'];
  if (command.includes('-L') || command.includes('--location') || command.includes('--location-trusted')) violations.push('command:redirect_following_forbidden');
  if (command.includes('-k') || command.includes('--insecure')) violations.push('command:tls_verification_disabled');
  if (!(command.includes('-I') || command.includes('--head'))) violations.push('command:head_required');
  const maxRedirsIndex = command.indexOf('--max-redirs');
  if (maxRedirsIndex < 0 || command[maxRedirsIndex + 1] !== '0') violations.push('command:max_redirs_zero_required');
  const writeOutIndex = command.findIndex((part) => part === '--write-out' || part === '-w');
  if (writeOutIndex < 0 || command[writeOutIndex + 1] !== '%{json}') violations.push('command:json_write_out_required');
  const urls = command.filter((part) => typeof part === 'string' && /^https:\/\//i.test(part));
  if (urls.length !== 1 || normalizeUrl(urls[0]) !== expectedUrl) violations.push('command:generated_hostname_url_mismatch');
  return violations;
}

function adaptCurlGeneratedHostnameReceipt(input) {
  const evidence = input && input.verified_deployment_evidence;
  const violations = [];
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) violations.push('evidence:missing_or_invalid');
  const expectedUrl = normalizeUrl(evidence && (String(evidence.generated_hostname || '').startsWith('http') ? evidence.generated_hostname : `https://${evidence.generated_hostname || ''}`));
  if (!expectedUrl) violations.push('evidence:generated_hostname_invalid');
  violations.push(...assessCurlCommand(input && input.command, expectedUrl));
  if (!Number.isInteger(input && input.curl_exit_code)) violations.push('curl:exit_code_invalid');
  if (!(input && typeof input.observed_at === 'string' && !Number.isNaN(Date.parse(input.observed_at)))) violations.push('curl:observed_at_invalid');

  let metrics = null;
  try {
    metrics = typeof (input && input.curl_write_out_json) === 'string'
      ? JSON.parse(input.curl_write_out_json)
      : input && input.curl_write_out_json;
  } catch { violations.push('curl:write_out_json_invalid'); }
  if (!metrics || typeof metrics !== 'object' || Array.isArray(metrics)) violations.push('curl:write_out_json_invalid');
  if (violations.length) return reject(violations);

  const method = String(metrics.method || '').toUpperCase();
  const statusCode = Number(metrics.response_code ?? metrics.http_code);
  const redirects = Number(metrics.num_redirects);
  const durationMs = Number(metrics.time_total) * 1000;
  const finalUrl = normalizeUrl(metrics.url_effective);
  const tlsVerified = Number(metrics.ssl_verify_result) === 0;
  const curlExitCode = input.curl_exit_code;

  if (!Number.isInteger(statusCode)) violations.push('curl:response_code_invalid');
  if (!Number.isInteger(redirects) || redirects < 0) violations.push('curl:num_redirects_invalid');
  if (!Number.isFinite(durationMs) || durationMs < 0) violations.push('curl:time_total_invalid');
  if (!finalUrl) violations.push('curl:url_effective_invalid');
  if (!['HEAD'].includes(method)) violations.push('curl:method_not_head');
  if (curlExitCode !== 0) violations.push('curl:transfer_failed');
  if (!tlsVerified) violations.push('curl:tls_verification_failed');
  if (violations.length) return reject(violations);

  const assessment = assessGeneratedHostnameObservation({
    verified_deployment_evidence: evidence,
    observation: {
      requested_url: expectedUrl,
      final_url: finalUrl,
      method,
      status_code: statusCode,
      redirect_count: redirects,
      tls_verified: tlsVerified,
      observed_at: input.observed_at,
      duration_ms: durationMs,
      network_error: curlExitCode === 0 ? null : `curl_exit_${curlExitCode}`
    }
  });
  if (!assessment.verified) return reject(assessment.violations.map((v) => `observation:${v}`));

  const receiptBase = {
    schema_version: 1,
    source_boundary: 'curl_write_out_json_generated_hostname_receipt_v1',
    command_contract: 'curl_HEAD_no_redirects_TLS_verified_write_out_json',
    expected_commit_sha: evidence.expected_commit_sha,
    deployment_id: evidence.deployment_id,
    generated_hostname: evidence.generated_hostname,
    evidence_pipeline_sha256: evidence.evidence_pipeline_sha256,
    observation_sha256: assessment.evidence.observation_sha256,
    observed_at: assessment.evidence.observed_at,
    curl_exit_code: curlExitCode,
    curl_metrics: {
      method,
      response_code: statusCode,
      num_redirects: redirects,
      url_effective: finalUrl,
      ssl_verify_result: Number(metrics.ssl_verify_result),
      time_total_seconds: Number(metrics.time_total)
    },
    retained_raw_write_out_required: true,
    credentials_retained: false
  };
  return {
    verified: true,
    violations: [],
    receipt: { ...receiptBase, receipt_sha256: crypto.createHash('sha256').update(canonicalize(receiptBase)).digest('hex') },
    observation_assessment: assessment,
    claim_boundary: assessment.claim_boundary
  };
}

module.exports = { adaptCurlGeneratedHostnameReceipt, assessCurlCommand };
