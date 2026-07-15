'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { assessOidcBoundRepertoryPublicationReadiness } = require('./assessOidcBoundRepertoryPublicationReadiness.v1.cjs');

const repertory = JSON.parse(readFileSync(join(__dirname, 'HOURLY_REPERTORY.v1.json'), 'utf8'));
const sha = 'a'.repeat(40);
const pipelineSha = 'b'.repeat(64);
const challengeSha = 'c'.repeat(64);
const capabilityTranscriptSha = 'd'.repeat(64);
const hostnameTranscriptSha = 'e'.repeat(64);
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
          id: 'dpl_OidcBoundPublication1',
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
        method: 'HEAD', response_code: 200, num_redirects: 0,
        url_effective: `https://${hostname}/`, ssl_verify_result: 0, time_total: 0.001,
      },
      observed_at: '2026-07-15T21:30:30Z',
    },
    curl_command: ['curl', '--silent', '--show-error', '--head', '--max-redirs', '0', '--write-out', '%{json}', '--output', '/dev/null', `https://${hostname}`],
    curl_exit_code: 0,
    curl_write_out_json: {
      method: 'HEAD', response_code: 200, num_redirects: 0,
      url_effective: `https://${hostname}/`, ssl_verify_result: 0, time_total: 0.041,
    },
    observed_at: '2026-07-15T21:31:00Z',
    github_oidc_signature_verification: 'externally_verified',
    github_oidc_verified_claims: {
      iss: 'https://token.actions.githubusercontent.com',
      aud: 'mirror-cartographer-vercel-evidence-v1',
      repository: 'MirrorCartographer/mirror-cartographer-ui',
      repository_id: '1003910384',
      workflow_sha: sha,
      workflow_ref: 'MirrorCartographer/mirror-cartographer-ui/.github/workflows/vercel-commit-evidence.yml@refs/heads/main',
      run_id: '9876543210',
      run_attempt: '1',
      runner_environment: 'github-hosted',
      jti: 'oidc-jti-test-0001',
      iat: 1784151000,
      exp: 1784151600,
    },
    github_oidc_expected: {
      audience: 'mirror-cartographer-vercel-evidence-v1',
      repository: 'MirrorCartographer/mirror-cartographer-ui',
      repository_id: '1003910384',
      commit_sha: sha,
      workflow_ref: 'MirrorCartographer/mirror-cartographer-ui/.github/workflows/vercel-commit-evidence.yml@refs/heads/main',
      run_id: '9876543210',
      run_attempt: '1',
      runner_environment: 'github-hosted',
      observed_at_epoch: 1784151060,
      challenge_receipt_sha256: challengeSha,
      capability_transcript_sha256: capabilityTranscriptSha,
      hostname_transcript_sha256: hostnameTranscriptSha,
    },
    challenge_receipt_sha256: challengeSha,
    capability_transcript_sha256: capabilityTranscriptSha,
    hostname_transcript_sha256: hostnameTranscriptSha,
  };
}

test('accepts exact-commit publication evidence bound to an externally verified GitHub OIDC run', () => {
  const result = assessOidcBoundRepertoryPublicationReadiness(validInput());
  assert.equal(result.ready, true, JSON.stringify(result.violations));
  assert.equal(result.runtime_activation_performed, false);
  assert.equal(result.github_oidc_run_verified, true);
  assert.match(result.evidence.github_oidc_receipt_sha256, /^[0-9a-f]{64}$/);
  assert.equal(result.evidence.github_oidc_run_id, '9876543210');
  assert.equal(result.evidence.github_oidc_run_attempt, '1');
  assert.equal(result.evidence.github_oidc_token_retention_required, false);
  assert.equal(result.evidence.github_oidc_same_process_claimed, false);
  assert.equal(result.evidence.github_oidc_hardware_attestation_claimed, false);
  assert.equal(result.evidence.github_oidc_transcript_content_truth_claimed, false);
});

test('rejects decoded-only OIDC claims', () => {
  const input = validInput();
  input.github_oidc_signature_verification = 'decoded_only';
  const result = assessOidcBoundRepertoryPublicationReadiness(input);
  assert.equal(result.ready, false);
  assert.equal(result.github_oidc_run_verified, false);
  assert.equal(result.violations.includes('github_oidc:oidc:signature_not_externally_verified'), true);
});

test('rejects workflow commit mismatch', () => {
  const input = validInput();
  input.github_oidc_verified_claims.workflow_sha = 'f'.repeat(40);
  const result = assessOidcBoundRepertoryPublicationReadiness(input);
  assert.equal(result.ready, false);
  assert.equal(result.violations.includes('github_oidc:oidc:workflow_sha_mismatch'), true);
});

test('rejects transcript digest substitution', () => {
  const input = validInput();
  input.hostname_transcript_sha256 = 'f'.repeat(64);
  const result = assessOidcBoundRepertoryPublicationReadiness(input);
  assert.equal(result.ready, false);
  assert.equal(result.github_oidc_run_verified, true);
  assert.equal(result.violations.includes('binding:hostname_transcript_digest_mismatch'), true);
});

test('rejects OIDC binding when underlying curl publication preconditions fail', () => {
  const input = validInput();
  input.curl_write_out_json.ssl_verify_result = 60;
  const result = assessOidcBoundRepertoryPublicationReadiness(input);
  assert.equal(result.ready, false);
  assert.equal(result.github_oidc_run_verified, false);
  assert.equal(result.violations.includes('github_oidc:publication_preconditions_rejected'), true);
  assert.equal(result.violations.some((value) => value.includes('tls_verification_failed')), true);
});
