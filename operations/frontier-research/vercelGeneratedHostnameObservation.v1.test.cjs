'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { assessGeneratedHostnameObservation } = require('./vercelGeneratedHostnameObservation.v1.cjs');

const base = {
  verified_deployment_evidence: {
    expected_commit_sha: 'a'.repeat(40),
    deployment_id: 'dpl_123',
    project_id: 'prj_123',
    generated_hostname: 'mirror-abc.vercel.app',
    observed_at: '2026-07-15T20:00:00Z',
    evidence_pipeline_sha256: 'b'.repeat(64),
    source_boundary: 'verified_vercel_deployment_evidence_pipeline_v1'
  },
  observation: {
    method: 'HEAD',
    status_code: 200,
    requested_url: 'https://mirror-abc.vercel.app/',
    final_url: 'https://mirror-abc.vercel.app/',
    redirect_count: 0,
    tls_verified: true,
    observed_at: '2026-07-15T20:01:00Z',
    duration_ms: 123
  }
};

test('accepts a direct successful HTTPS observation bound to verified deployment evidence', () => {
  const result = assessGeneratedHostnameObservation(base);
  assert.equal(result.verified, true);
  assert.match(result.evidence.observation_sha256, /^[0-9a-f]{64}$/);
  assert.equal(result.claim_boundary, 'generated_hostname_https_response_verified_only_no_content_alias_audio_browser_or_device_claims');
});

test('rejects requested hostname mismatch', () => {
  const result = assessGeneratedHostnameObservation({ ...base, observation: { ...base.observation, requested_url: 'https://other.vercel.app/' } });
  assert.equal(result.verified, false);
  assert.ok(result.violations.includes('binding:requested_url_mismatch'));
});

test('rejects redirects even when the final response is successful', () => {
  const result = assessGeneratedHostnameObservation({ ...base, observation: { ...base.observation, final_url: 'https://example.com/', redirect_count: 1 } });
  assert.equal(result.verified, false);
  assert.ok(result.violations.includes('observation:redirects_present'));
  assert.ok(result.violations.includes('binding:final_url_mismatch'));
});

test('rejects authentication and error responses without equating response with reachability', () => {
  for (const status_code of [401, 403, 404, 500]) {
    const result = assessGeneratedHostnameObservation({ ...base, observation: { ...base.observation, status_code } });
    assert.equal(result.verified, false);
    assert.ok(result.violations.includes('observation:status_not_successful'));
  }
});

test('rejects unsafe methods, TLS failure, and network errors', () => {
  const result = assessGeneratedHostnameObservation({
    ...base,
    observation: { ...base.observation, method: 'POST', tls_verified: false, network_error: 'ECONNRESET' }
  });
  assert.equal(result.verified, false);
  assert.ok(result.violations.includes('observation:method_not_safe_read'));
  assert.ok(result.violations.includes('observation:tls_not_verified'));
  assert.ok(result.violations.includes('observation:network_error'));
});

test('produces a deterministic digest independent of object insertion order', () => {
  const first = assessGeneratedHostnameObservation(base);
  const reorderedObservation = {
    duration_ms: 123,
    observed_at: '2026-07-15T20:01:00Z',
    tls_verified: true,
    redirect_count: 0,
    final_url: 'https://mirror-abc.vercel.app/',
    requested_url: 'https://mirror-abc.vercel.app/',
    status_code: 200,
    method: 'HEAD'
  };
  const second = assessGeneratedHostnameObservation({ verified_deployment_evidence: base.verified_deployment_evidence, observation: reorderedObservation });
  assert.equal(first.evidence.observation_sha256, second.evidence.observation_sha256);
});
