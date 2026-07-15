'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { assessCurlGeneratedHostnameSession } = require('./curlGeneratedHostnameSession.v1.cjs');
const { assessCurlGeneratedHostnameChallengeBinding, sha256 } = require('./curlGeneratedHostnameChallengeBinding.v1.cjs');

function baseInput() {
  return {
    session_id: 'curl-session-20260715T230600Z',
    max_session_skew_ms: 900000,
    capability_preflight: {
      curl_version_output: 'curl 8.7.1 (x86_64) libcurl/8.7.1 OpenSSL/3.0.0',
      curl_version_exit_code: 0,
      observed_at: '2026-07-15T23:06:00.000Z',
      write_out_probe: {
        method: 'HEAD', num_redirects: 0, response_code: 200,
        ssl_verify_result: 0, time_total: 0.1,
        url_effective: 'https://example.invalid/'
      }
    },
    hostname_observation: {
      verified_deployment_evidence: {
        verified: true,
        expected_commit_sha: 'a'.repeat(40),
        deployment_id: 'dpl_1234567890',
        generated_hostname: 'mirror-cartographer-ui-abc.vercel.app',
        evidence_pipeline_sha256: 'b'.repeat(64)
      },
      command: ['curl', '-I', '--max-redirs', '0', '--write-out', '%{json}', 'https://mirror-cartographer-ui-abc.vercel.app/'],
      curl_exit_code: 0,
      observed_at: '2026-07-15T23:06:08.000Z',
      curl_write_out_json: {
        method: 'HEAD', response_code: 200, num_redirects: 0,
        url_effective: 'https://mirror-cartographer-ui-abc.vercel.app/',
        ssl_verify_result: 0, time_total: 0.25
      }
    }
  };
}

function validInput() {
  const input = baseInput();
  const session = assessCurlGeneratedHostnameSession(input);
  const nonce = '0123456789abcdef0123456789abcdef';
  const capabilityRaw = `challenge=${nonce}\ncurl 8.7.1\nprobe=200`;
  const hostnameRaw = `challenge=${nonce}\nHTTP/2 200\nresponse_code=200`;
  return {
    ...input,
    challenge: { nonce, issued_at: '2026-07-15T23:05:59.000Z' },
    capability_transcript: {
      challenge_nonce: nonce,
      child_receipt_sha256: session.receipt.capability_receipt_sha256,
      raw_transcript: capabilityRaw,
      raw_transcript_sha256: sha256(capabilityRaw)
    },
    hostname_transcript: {
      challenge_nonce: nonce,
      child_receipt_sha256: session.receipt.hostname_receipt_sha256,
      raw_transcript: hostnameRaw,
      raw_transcript_sha256: sha256(hostnameRaw)
    }
  };
}

test('accepts two retained transcripts bound to a pre-issued challenge and child receipts', () => {
  const result = assessCurlGeneratedHostnameChallengeBinding(validInput());
  assert.equal(result.verified, true);
  assert.equal(result.receipt.transcript_challenge_participation_verified, true);
  assert.equal(result.receipt.same_process_claimed, false);
});

test('rejects a challenge issued after capability observation', () => {
  const input = validInput();
  input.challenge.issued_at = '2026-07-15T23:06:01.000Z';
  const result = assessCurlGeneratedHostnameChallengeBinding(input);
  assert.equal(result.verified, false);
  assert.ok(result.violations.includes('challenge:issued_after_capability_observation'));
});

test('rejects a transcript that does not contain the challenge', () => {
  const input = validInput();
  input.hostname_transcript.raw_transcript = 'HTTP/2 200';
  input.hostname_transcript.raw_transcript_sha256 = sha256('HTTP/2 200');
  const result = assessCurlGeneratedHostnameChallengeBinding(input);
  assert.equal(result.verified, false);
  assert.ok(result.violations.includes('hostname_transcript:nonce_not_in_raw_transcript'));
});

test('rejects a transcript bound to the wrong child receipt', () => {
  const input = validInput();
  input.capability_transcript.child_receipt_sha256 = 'f'.repeat(64);
  const result = assessCurlGeneratedHostnameChallengeBinding(input);
  assert.equal(result.verified, false);
  assert.ok(result.violations.includes('capability_transcript:child_receipt_mismatch'));
});

test('rejects transcript mutation after digest capture', () => {
  const input = validInput();
  input.capability_transcript.raw_transcript += '\nmutated';
  const result = assessCurlGeneratedHostnameChallengeBinding(input);
  assert.equal(result.verified, false);
  assert.ok(result.violations.includes('capability_transcript:raw_transcript_digest_invalid'));
});

test('changes the parent digest when a retained transcript changes', () => {
  const first = assessCurlGeneratedHostnameChallengeBinding(validInput());
  const input = validInput();
  input.hostname_transcript.raw_transcript += '\nheader=x';
  input.hostname_transcript.raw_transcript_sha256 = sha256(input.hostname_transcript.raw_transcript);
  const second = assessCurlGeneratedHostnameChallengeBinding(input);
  assert.notEqual(first.receipt.receipt_sha256, second.receipt.receipt_sha256);
});
