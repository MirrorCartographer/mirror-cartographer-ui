'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { assessCurlGeneratedHostnameSession } = require('./curlGeneratedHostnameSession.v1.cjs');

function validInput() {
  const expectedCommit = 'a'.repeat(40);
  return {
    session_id: 'curl-session-20260715T225600Z',
    max_session_skew_ms: 900000,
    capability_preflight: {
      curl_version_output: 'curl 8.7.1 (x86_64) libcurl/8.7.1 OpenSSL/3.0.0',
      curl_version_exit_code: 0,
      observed_at: '2026-07-15T22:56:00.000Z',
      write_out_probe: {
        method: 'HEAD',
        num_redirects: 0,
        response_code: 200,
        ssl_verify_result: 0,
        time_total: 0.1,
        url_effective: 'https://example.invalid/'
      }
    },
    hostname_observation: {
      verified_deployment_evidence: {
        verified: true,
        expected_commit_sha: expectedCommit,
        deployment_id: 'dpl_1234567890',
        generated_hostname: 'mirror-cartographer-ui-abc.vercel.app',
        evidence_pipeline_sha256: 'b'.repeat(64)
      },
      command: [
        'curl', '-I', '--max-redirs', '0', '--write-out', '%{json}',
        'https://mirror-cartographer-ui-abc.vercel.app/'
      ],
      curl_exit_code: 0,
      observed_at: '2026-07-15T22:56:08.000Z',
      curl_write_out_json: {
        method: 'HEAD',
        response_code: 200,
        num_redirects: 0,
        url_effective: 'https://mirror-cartographer-ui-abc.vercel.app/',
        ssl_verify_result: 0,
        time_total: 0.25
      }
    }
  };
}

test('accepts capability and hostname receipts from one bounded session', () => {
  const result = assessCurlGeneratedHostnameSession(validInput());
  assert.equal(result.verified, true);
  assert.equal(result.receipt.observed_skew_ms, 8000);
  assert.equal(result.receipt.same_bounded_session_verified, true);
  assert.equal(result.receipt.same_process_claimed, false);
});

test('rejects capability evidence captured after the hostname request', () => {
  const input = validInput();
  input.capability_preflight.observed_at = '2026-07-15T22:57:00.000Z';
  const result = assessCurlGeneratedHostnameSession(input);
  assert.equal(result.verified, false);
  assert.ok(result.violations.includes('session:capability_observed_after_hostname'));
});

test('rejects stale capability evidence outside the bounded session', () => {
  const input = validInput();
  input.capability_preflight.observed_at = '2026-07-15T22:30:00.000Z';
  const result = assessCurlGeneratedHostnameSession(input);
  assert.equal(result.verified, false);
  assert.ok(result.violations.includes('session:capability_observation_too_old'));
});

test('rejects an invalid session identifier', () => {
  const input = validInput();
  input.session_id = 'bad id';
  const result = assessCurlGeneratedHostnameSession(input);
  assert.equal(result.verified, false);
  assert.ok(result.violations.includes('session:id_invalid'));
});

test('changes the parent digest when the session identity changes', () => {
  const first = assessCurlGeneratedHostnameSession(validInput());
  const secondInput = validInput();
  secondInput.session_id = 'curl-session-20260715T225601Z';
  const second = assessCurlGeneratedHostnameSession(secondInput);
  assert.notEqual(first.receipt.receipt_sha256, second.receipt.receipt_sha256);
});
