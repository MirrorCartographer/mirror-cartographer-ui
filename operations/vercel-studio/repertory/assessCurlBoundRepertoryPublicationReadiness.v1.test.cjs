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

test('accepts retained curl evidence while preserving runtime activation false', () => {
  const result = assessCurlBoundRepertoryPublicationReadiness(validInput());
  assert.equal(result.ready, true, JSON.stringify(result.violations));
  assert.equal(result.runtime_activation_performed, false);
  assert.equal(result.curl_receipt_verified, true);
  assert.match(result.evidence.curl_receipt_sha256, /^[0-9a-f]{64}$/);
  assert.equal(result.evidence.retained_raw_write_out_required, true);
});

test('rejects redirect-following curl command before publication assessment', () => {
  const input = validInput();
  input.curl_command.splice(1, 0, '--location');
  const result = assessCurlBoundRepertoryPublicationReadiness(input);
  assert.equal(result.ready, false);
  assert.equal(result.curl_receipt_verified, false);
  assert.equal(result.violations.includes('curl:command:redirect_following_forbidden'), true);
});

test('rejects TLS verification failure', () => {
  const input = validInput();
  input.curl_write_out_json.ssl_verify_result = 60;
  const result = assessCurlBoundRepertoryPublicationReadiness(input);
  assert.equal(result.ready, false);
  assert.equal(result.violations.includes('curl:curl:tls_verification_failed'), true);
});

test('rejects deployment commit mismatch before curl adaptation', () => {
  const input = validInput();
  input.verified_deployment_pipeline.identity.normalized.deployment.gitSource.sha = 'c'.repeat(40);
  const result = assessCurlBoundRepertoryPublicationReadiness(input);
  assert.equal(result.ready, false);
  assert.equal(result.curl_receipt_verified, false);
  assert.equal(result.violations.some((v) => v.includes('deployment_commit_mismatch')), true);
});

test('rejects repertory runtime boundary weakening after verified curl evidence', () => {
  const input = validInput();
  input.repertory = structuredClone(repertory);
  input.repertory.activation_boundary.runtime_integration = 'performed';
  const result = assessCurlBoundRepertoryPublicationReadiness(input);
  assert.equal(result.ready, false);
  assert.equal(result.runtime_activation_performed, false);
  assert.equal(result.violations.includes('repertory:runtime_boundary_not_fail_closed'), true);
});
