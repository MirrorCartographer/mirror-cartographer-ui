'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  DEFAULT_MAX_AGE_MS,
  verifyRuntimeStageFreshness,
} = require('./verifyRuntimeStageFreshness.v1.cjs');

function stageVerification(overrides = {}) {
  return {
    contract_id: 'vercel-studio-runtime-stage-verification-v1',
    verified: true,
    classification: 'commit_bound_runtime_stage_verified',
    observed_at: '2026-07-15T00:00:00.000Z',
    production_id: 'body-constellation',
    commit_sha: 'a'.repeat(40),
    deployment_id: 'dpl_immutable',
    deployment_url: 'https://example.vercel.app/',
    repertory_contract_id: 'mirror-cartographer-hourly-repertory-v1',
    audio_policy_verified: true,
    privacy_boundary_verified: true,
    side_effects_performed: false,
    ...overrides,
  };
}

test('accepts a recent commit-bound stage verification', () => {
  const result = verifyRuntimeStageFreshness({
    stageVerification: stageVerification(),
    checkedAt: '2026-07-15T00:59:00.000Z',
  });
  assert.equal(result.verified, true);
  assert.equal(result.classification, 'commit_bound_runtime_stage_fresh');
  assert.equal(result.age_ms, 59 * 60 * 1000);
  assert.equal(result.max_age_ms, DEFAULT_MAX_AGE_MS);
  assert.equal(result.side_effects_performed, false);
});

test('rejects a stale stage verification', () => {
  assert.throws(() => verifyRuntimeStageFreshness({
    stageVerification: stageVerification(),
    checkedAt: '2026-07-15T01:11:00.000Z',
  }), /stale/);
});

test('rejects an observation beyond permitted future clock skew', () => {
  assert.throws(() => verifyRuntimeStageFreshness({
    stageVerification: stageVerification({ observed_at: '2026-07-15T00:06:00.000Z' }),
    checkedAt: '2026-07-15T00:00:00.000Z',
  }), /too far in the future/);
});

test('accepts an observation within permitted future clock skew', () => {
  const result = verifyRuntimeStageFreshness({
    stageVerification: stageVerification({ observed_at: '2026-07-15T00:04:00.000Z' }),
    checkedAt: '2026-07-15T00:00:00.000Z',
  });
  assert.equal(result.age_ms, -4 * 60 * 1000);
});

test('rejects an unverified upstream stage result', () => {
  assert.throws(() => verifyRuntimeStageFreshness({
    stageVerification: stageVerification({ verified: false }),
    checkedAt: '2026-07-15T00:01:00.000Z',
  }), /verified must be true/);
});

test('rejects invalid freshness bounds', () => {
  assert.throws(() => verifyRuntimeStageFreshness({
    stageVerification: stageVerification(),
    checkedAt: '2026-07-15T00:01:00.000Z',
    maxAgeMs: 0,
  }), /maxAgeMs must be a positive integer/);
});
