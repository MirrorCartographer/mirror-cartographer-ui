'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { assessCurlGeneratedHostnamePipeline } = require('./curlGeneratedHostnamePipeline.v1.cjs');

const commit = 'a'.repeat(40);
const pipelineSha = 'b'.repeat(64);
const hostname = 'example-deployment.vercel.app';
const observedAt = '2026-07-15T21:54:00Z';

function validInput() {
  return {
    capability_preflight: {
      curl_version_output: 'curl 8.10.1 (x86_64) libcurl/8.10.1 OpenSSL/3.0.0',
      curl_version_exit_code: 0,
      observed_at: observedAt,
      write_out_probe: {
        method: '',
        num_redirects: 0,
        response_code: 0,
        ssl_verify_result: 0,
        time_total: 0,
        url_effective: ''
      }
    },
    hostname_observation: {
      verified_deployment_evidence: {
        source_boundary: 'verified_vercel_deployment_evidence_pipeline_v1',
        expected_commit_sha: commit,
        deployment_id: 'dpl_test',
        generated_hostname: hostname,
        evidence_pipeline_sha256: pipelineSha
      },
      command: ['curl', '--head', '--max-redirs', '0', '--write-out', '%{json}', `https://${hostname}`],
      curl_exit_code: 0,
      observed_at: observedAt,
      curl_write_out_json: {
        method: 'HEAD',
        response_code: 200,
        num_redirects: 0,
        ssl_verify_result: 0,
        time_total: 0.125,
        url_effective: `https://${hostname}/`
      }
    }
  };
}

test('accepts only when capability and hostname observation both verify', () => {
  const result = assessCurlGeneratedHostnamePipeline(validInput());
  assert.equal(result.verified, true);
  assert.equal(result.stage, 'complete');
  assert.match(result.receipt.receipt_sha256, /^[0-9a-f]{64}$/);
  assert.equal(result.receipt.capability_receipt_sha256, result.capability_assessment.receipt.receipt_sha256);
  assert.equal(result.receipt.hostname_receipt_sha256, result.hostname_receipt_assessment.receipt.receipt_sha256);
});

test('fails at capability preflight before hostname evidence can be promoted', () => {
  const input = validInput();
  input.capability_preflight.curl_version_output = 'curl 7.71.1';
  const result = assessCurlGeneratedHostnamePipeline(input);
  assert.equal(result.verified, false);
  assert.equal(result.stage, 'capability_preflight');
  assert.equal(result.hostname_receipt_assessment, null);
  assert.ok(result.violations.includes('capability:curl_version:method_metric_unavailable_before_7_72_0'));
});

test('preserves a distinct hostname-observation rejection boundary', () => {
  const input = validInput();
  input.hostname_observation.curl_write_out_json.response_code = 503;
  const result = assessCurlGeneratedHostnamePipeline(input);
  assert.equal(result.verified, false);
  assert.equal(result.stage, 'hostname_observation');
  assert.equal(result.capability_assessment.verified, true);
  assert.equal(result.hostname_receipt_assessment.verified, false);
  assert.ok(result.violations.includes('hostname:observation:observation:status_not_successful'));
});

test('pipeline digest is canonical and stable', () => {
  const left = assessCurlGeneratedHostnamePipeline(validInput());
  const rightInput = validInput();
  rightInput.capability_preflight.write_out_probe = {
    url_effective: '',
    time_total: 0,
    ssl_verify_result: 0,
    response_code: 0,
    num_redirects: 0,
    method: ''
  };
  const right = assessCurlGeneratedHostnamePipeline(rightInput);
  assert.equal(left.receipt.receipt_sha256, right.receipt.receipt_sha256);
});
