'use strict';

const crypto = require('node:crypto');
const { assessCurlGeneratedHostnameSession } = require('./curlGeneratedHostnameSession.v1.cjs');
const { canonicalize } = require('./vercelGeneratedHostnameObservation.v1.cjs');

const NONCE_RE = /^[a-f0-9]{32,128}$/;
const SHA256_RE = /^[a-f0-9]{64}$/;

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function reject(violations, sessionAssessment = null) {
  return {
    verified: false,
    violations: [...new Set(violations)].sort(),
    receipt: null,
    session_assessment: sessionAssessment,
    claim_boundary: 'challenge_binding_rejected_no_same_session_or_transcript_participation_claim'
  };
}

function validateTranscript(name, transcript, nonce, expectedReceiptSha, violations) {
  if (!transcript || typeof transcript !== 'object') {
    violations.push(`${name}:missing`);
    return;
  }
  if (transcript.challenge_nonce !== nonce) violations.push(`${name}:nonce_mismatch`);
  if (transcript.child_receipt_sha256 !== expectedReceiptSha) {
    violations.push(`${name}:child_receipt_mismatch`);
  }
  if (typeof transcript.raw_transcript !== 'string' || transcript.raw_transcript.length === 0) {
    violations.push(`${name}:raw_transcript_missing`);
  } else {
    if (!transcript.raw_transcript.includes(nonce)) violations.push(`${name}:nonce_not_in_raw_transcript`);
    if (!SHA256_RE.test(transcript.raw_transcript_sha256 || '') ||
        sha256(transcript.raw_transcript) !== transcript.raw_transcript_sha256) {
      violations.push(`${name}:raw_transcript_digest_invalid`);
    }
  }
}

function assessCurlGeneratedHostnameChallengeBinding(input) {
  const sessionAssessment = assessCurlGeneratedHostnameSession(input);
  if (!sessionAssessment.verified) {
    return reject(sessionAssessment.violations.map((v) => `session:${v}`), sessionAssessment);
  }

  const violations = [];
  const challenge = input && input.challenge;
  const nonce = challenge && challenge.nonce;
  const issuedAt = Date.parse(challenge && challenge.issued_at);
  const capabilityAt = Date.parse(sessionAssessment.receipt.capability_observed_at);

  if (!NONCE_RE.test(nonce || '')) violations.push('challenge:nonce_invalid');
  if (!Number.isFinite(issuedAt)) violations.push('challenge:issued_at_invalid');
  if (Number.isFinite(issuedAt) && issuedAt > capabilityAt) {
    violations.push('challenge:issued_after_capability_observation');
  }

  validateTranscript(
    'capability_transcript',
    input && input.capability_transcript,
    nonce,
    sessionAssessment.receipt.capability_receipt_sha256,
    violations
  );
  validateTranscript(
    'hostname_transcript',
    input && input.hostname_transcript,
    nonce,
    sessionAssessment.receipt.hostname_receipt_sha256,
    violations
  );

  if (violations.length) return reject(violations, sessionAssessment);

  const receiptBase = {
    schema_version: 1,
    source_boundary: 'curl_generated_hostname_challenge_transcript_binding_v1',
    challenge_nonce_sha256: sha256(nonce),
    challenge_issued_at: new Date(issuedAt).toISOString(),
    session_receipt_sha256: sessionAssessment.receipt.receipt_sha256,
    capability_transcript_sha256: input.capability_transcript.raw_transcript_sha256,
    hostname_transcript_sha256: input.hostname_transcript.raw_transcript_sha256,
    capability_receipt_sha256: sessionAssessment.receipt.capability_receipt_sha256,
    hostname_receipt_sha256: sessionAssessment.receipt.hostname_receipt_sha256,
    expected_commit_sha: sessionAssessment.receipt.expected_commit_sha,
    deployment_id: sessionAssessment.receipt.deployment_id,
    generated_hostname: sessionAssessment.receipt.generated_hostname,
    retained_raw_transcripts_required: true,
    transcript_challenge_participation_verified: true,
    same_process_claimed: false,
    credentials_retained: false
  };

  return {
    verified: true,
    violations: [],
    receipt: {
      ...receiptBase,
      receipt_sha256: sha256(canonicalize(receiptBase))
    },
    session_assessment: sessionAssessment,
    claim_boundary: 'challenge_presence_and_child_receipt_binding_verified_in_two_retained_transcripts_only_no_same_process_binary_content_alias_audio_browser_or_device_claims'
  };
}

module.exports = { assessCurlGeneratedHostnameChallengeBinding, sha256 };
