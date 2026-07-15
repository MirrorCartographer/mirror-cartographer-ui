'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { verifyRuntimeStageFreshnessV2 } = require('./verifyRuntimeStageFreshness.v2.cjs');

function stage(overrides = {}) {
  return {
    contract_id: 'vercel-studio-runtime-stage-verification-v1',
    verified: true,
    classification: 'commit_bound_runtime_stage_verified',
    observed_at: '2026-07-15T00:00:00.000Z',
    production_id: 'body-constellation',
    commit_sha: 'A'.repeat(40),
    deployment_id: 'dpl_immutable',
    deployment_url: 'https://example.vercel.app/',
    repertory_contract_id: 'mirror-cartographer-hourly-repertory-v1',
    audio_policy_verified: true,
    privacy_boundary_verified: true,
    side_effects_performed: false,
    ...overrides,
  };
}

test('promotes recent identity-bound stage evidence', () => {
  const result = verifyRuntimeStageFreshnessV2({ stageVerification: stage(), checkedAt: '2026-07-15T00:59:00Z' });
  assert.equal(result.classification, 'commit_bound_runtime_stage_fresh_identity_bound');
  assert.equal(result.commit_sha, 'a'.repeat(40));
  assert.equal(result.deployment_url, 'https://example.vercel.app/');
});

test('rejects a missing deployment identity field', () => {
  assert.throws(() => verifyRuntimeStageFreshnessV2({ stageVerification: stage({ deployment_id: undefined }), checkedAt: '2026-07-15T00:01:00Z' }), /deployment_id/);
});

test('rejects malformed commit identity', () => {
  assert.throws(() => verifyRuntimeStageFreshnessV2({ stageVerification: stage({ commit_sha: 'abc' }), checkedAt: '2026-07-15T00:01:00Z' }), /40-character/);
});

test('rejects non-HTTPS or credential-bearing deployment URLs', () => {
  assert.throws(() => verifyRuntimeStageFreshnessV2({ stageVerification: stage({ deployment_url: 'http://example.test' }), checkedAt: '2026-07-15T00:01:00Z' }), /HTTPS/);
  assert.throws(() => verifyRuntimeStageFreshnessV2({ stageVerification: stage({ deployment_url: 'https://user:secret@example.test' }), checkedAt: '2026-07-15T00:01:00Z' }), /credentials/);
});

test('rejects policy booleans that are not explicitly verified', () => {
  assert.throws(() => verifyRuntimeStageFreshnessV2({ stageVerification: stage({ audio_policy_verified: false }), checkedAt: '2026-07-15T00:01:00Z' }), /audio_policy_verified/);
  assert.throws(() => verifyRuntimeStageFreshnessV2({ stageVerification: stage({ privacy_boundary_verified: undefined }), checkedAt: '2026-07-15T00:01:00Z' }), /privacy_boundary_verified/);
});

test('rejects side-effectful, stale, and future-skewed evidence', () => {
  assert.throws(() => verifyRuntimeStageFreshnessV2({ stageVerification: stage({ side_effects_performed: true }), checkedAt: '2026-07-15T00:01:00Z' }), /side_effects_performed/);
  assert.throws(() => verifyRuntimeStageFreshnessV2({ stageVerification: stage(), checkedAt: '2026-07-15T01:11:00Z' }), /stale/);
  assert.throws(() => verifyRuntimeStageFreshnessV2({ stageVerification: stage({ observed_at: '2026-07-15T00:06:00Z' }), checkedAt: '2026-07-15T00:00:00Z' }), /future/);
});
