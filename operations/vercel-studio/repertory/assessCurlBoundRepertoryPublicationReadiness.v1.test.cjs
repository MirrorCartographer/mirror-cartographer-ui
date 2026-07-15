'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { assessCurlBoundRepertoryPublicationReadiness } = require('./assessCurlBoundRepertoryPublicationReadiness.v1.cjs');

const repertory = JSON.parse(readFileSync(join(__dirname, 'HOURLY_REPERTORY.v1.json'), 'utf8'));
const sha = 'a'.repeat(40);
const pipelineSha = 'b'.repeat(64);
const hostname = 'mirror-cartographer-ready.example.vercel.app';

function verifiedPipeline() {
  return {
    verified: true,
    violations: [],
    claim_boundary: 'authenticated_retrieval_and_immutable_deployment_identity_verified_only',
    pipeline_sha256: pipelineSha,
    retrieval: { verified: true },
    identity: {
      verified: true,
      normalized: {
        expected_commit_sha: sha,
        observed_at: '2026-07-15T21:30:00Z',
        deployment: {
          id: 'dpl_CurlBoundPublication1',
          projectId: 'prj_mirrorcartographer',
          url: hostname,
          gitSource: { sha },
        },
      },
    },
    normalized: { expected_commit_sha: sha },
  };
}

function validInput() {
  return {
    repertory,
    expected_commit_sha: sha,
    verified_deployment_pipeline: verifiedPipeline(),
    curl_session_id: 'curl-session-20260715T2130Z',
    max_session_skew_ms: 15 * 60 * 1000,
    curl_capability_preflight: {
      curl_version_output: 'curl 8.10.1 (x86_64-pc-linux-gnu) libcurl/8.10.1 OpenSSL/3.0.0',
      curl_version_exit_code: 0,
      write_out_probe: {
        method: 'HEAD',
        response_code: 200,
        num_redirects: 0,
        url_effective: `https://${hostname}/`,
        ssl_verify_result: 0,
        time_total: 0.001,
      },
      observed_at: '2026-07-15T21:30:30Z',
    },
    curl_command: ['curl', '--silent', '--show-error', '--head', '--max-redirs', '0', '--write-out', '%{json}', '--output', '/dev/null', `https://${hostname}`],
    curl_exit_code: 0,
    curl_write_out_json: {
      method: 'HEAD',
      response_code: 200,
      num_redirects: 0,
      url_effective: `https://${hostname}/`,
      ssl_verify_result: 0,
      time_total: 0.041,
    },
    observed_at: '2026-07-15T21:31:00Z',
  };
}

test('accepts one bounded retained curl session while preserving runtime activation false', () => {
  const result = assessCurlBoundRepertoryPublicationReadiness(validInput());
  assert.equal(result.ready, true, JSON.stringify(result.violations));
  assert.equal(result.runtime_activation_performed, false);
  assert.equal(result.curl_session_verified, true);
  assert.equal(result.curl_pipeline_verified, true);
  assert.equal(result.curl_receipt_verified, true);
  assert.match(result.evidence.curl_session_sha256, /^[0-9a-f]{64}$/);
  assert.match(result.evidence.curl_pipeline_sha256, /^[0-9a-f]{64}$/);
  assert.match(result.evidence.curl_capability_receipt_sha256, /^[0-9a-f]{64}$/);
  assert.match(result.evidence.curl_receipt_sha256, /^[0-9a-f]{64}$/);
  assert.equal(result.evidence.curl_session_id, 'curl-session-20260715T2130Z');
  assert.equal(result.evidence.curl_session_observed_skew_ms, 30000);
  assert.equal(result.evidence.same_process_claimed, false);
  assert.equal(result.evidence.same_bounded_session_verified, true);
  assert.equal(result.evidence.retained_capability_receipt_required, true);
  assert.equal(result.evidence.retained_raw_write_out_required, true);
});

test('rejects unsupported curl before hostname publication assessment', () => {
  const input = validInput();
  input.curl_capability_preflight.curl_version_output = 'curl 7.71.1 libcurl/7.71.1';
  const result = assessCurlBoundRepertoryPublicationReadiness(input);
  assert.equal(result.ready, false);
  assert.equal(result.curl_session_verified, false);
  assert.equal(result.curl_pipeline_verified, false);
  assert.equal(result.curl_receipt_verified, false);
  assert.equal(result.violations.includes('curl_session:pipeline:capability:curl_version:method_metric_unavailable_before_7_72_0'), true);
  assert.equal(result.evidence.curl_session_sha256, null);
});

test('rejects redirect-following curl command after capability preflight', () => {
  const input = validInput();
  input.curl_command.splice(1, 0, '--location');
  const result = assessCurlBoundRepertoryPublicationReadiness(input);
  assert.equal(result.ready, false);
  assert.equal(result.curl_session_verified, false);
  assert.equal(result.violations.includes('curl_session:pipeline:hostname:command:redirect_following_forbidden'), true);
});

test('rejects TLS verification failure', () => {
  const input = validInput();
  input.curl_write_out_json.ssl_verify_result = 60;
  const result = assessCurlBoundRepertoryPublicationReadiness(input);
  assert.equal(result.ready, false);
  assert.equal(result.violations.includes('curl_session:pipeline:hostname:curl:tls_verification_failed'), true);
});

test('rejects deployment commit mismatch before curl session adaptation', () => {
  const input = validInput();
  input.verified_deployment_pipeline.identity.normalized.deployment.gitSource.sha = 'c'.repeat(40);
  const result = assessCurlBoundRepertoryPublicationReadiness(input);
  assert.equal(result.ready, false);
  assert.equal(result.curl_session_verified, false);
  assert.equal(result.curl_pipeline_verified, false);
  assert.equal(result.curl_receipt_verified, false);
  assert.equal(result.violations.some((v) => v.includes('deployment_commit_mismatch')), true);
});

test('rejects missing curl session identity', () => {
  const input = validInput();
  delete input.curl_session_id;
  const result = assessCurlBoundRepertoryPublicationReadiness(input);
  assert.equal(result.ready, false);
  assert.equal(result.curl_session_verified, false);
  assert.equal(result.violations.includes('curl_session:session:id_invalid'), true);
});

test('rejects capability evidence outside the bounded session window', () => {
  const input = validInput();
  input.curl_capability_preflight.observed_at = '2026-07-15T21:00:00Z';
  const result = assessCurlBoundRepertoryPublicationReadiness(input);
  assert.equal(result.ready, false);
  assert.equal(result.curl_session_verified, false);
  assert.equal(result.violations.includes('curl_session:session:capability_observation_too_old'), true);
});

test('rejects capability evidence observed after hostname evidence', () => {
  const input = validInput();
  input.curl_capability_preflight.observed_at = '2026-07-15T21:32:00Z';
  const result = assessCurlBoundRepertoryPublicationReadiness(input);
  assert.equal(result.ready, false);
  assert.equal(result.curl_session_verified, false);
  assert.equal(result.violations.includes('curl_session:session:capability_observed_after_hostname'), true);
});

test('rejects repertory runtime boundary weakening after verified bounded curl session', () => {
  const input = validInput();
  input.repertory = structuredClone(repertory);
  input.repertory.activation_boundary.runtime_integration = 'performed';
  const result = assessCurlBoundRepertoryPublicationReadiness(input);
  assert.equal(result.ready, false);
  assert.equal(result.runtime_activation_performed, false);
  assert.equal(result.curl_session_verified, true);
  assert.equal(result.curl_pipeline_verified, true);
  assert.equal(result.violations.includes('repertory:runtime_boundary_not_fail_closed'), true);
});
