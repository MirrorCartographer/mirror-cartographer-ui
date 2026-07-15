'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { nextUtcHourBoundary, verifyRuntimeStageFreshnessV3 } = require('./verifyRuntimeStageFreshness.v3.cjs');

function stage(overrides = {}) {
  return {
    contract_id: 'vercel-studio-runtime-stage-verification-v1',
    verified: true,
    classification: 'commit_bound_runtime_stage_verified',
    observed_at: '2026-07-15T00:15:00.000Z',
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

test('promotes evidence only inside its deterministic repertory hour', () => {
  const result = verifyRuntimeStageFreshnessV3({ stageVerification: stage(), checkedAt: '2026-07-15T00:59:59.999Z' });
  assert.equal(result.classification, 'commit_bound_runtime_stage_fresh_current_hour');
  assert.equal(result.repertory_hour_utc, 0);
  assert.equal(result.stage_expires_at, '2026-07-15T01:00:00.000Z');
});

test('rejects evidence at the exact next-hour boundary even when age is below v2 max age', () => {
  assert.throws(() => verifyRuntimeStageFreshnessV3({ stageVerification: stage(), checkedAt: '2026-07-15T01:00:00.000Z' }), /previous deterministic repertory hour/);
});

test('rejects evidence later in the next hour even when v2 would still call it fresh', () => {
  assert.throws(() => verifyRuntimeStageFreshnessV3({ stageVerification: stage(), checkedAt: '2026-07-15T01:20:00.000Z' }), /previous deterministic repertory hour/);
});

test('handles UTC day rollover deterministically', () => {
  const result = verifyRuntimeStageFreshnessV3({ stageVerification: stage({ observed_at: '2026-07-15T23:59:00.000Z' }), checkedAt: '2026-07-15T23:59:59.999Z' });
  assert.equal(result.stage_expires_at, '2026-07-16T00:00:00.000Z');
  assert.equal(result.repertory_hour_utc, 23);
});

test('computes month and year rollovers through UTC date arithmetic', () => {
  assert.equal(nextUtcHourBoundary(new Date('2026-12-31T23:30:00.000Z')).toISOString(), '2027-01-01T00:00:00.000Z');
});

test('preserves all v2 identity, policy, freshness, and side-effect checks', () => {
  assert.throws(() => verifyRuntimeStageFreshnessV3({ stageVerification: stage({ commit_sha: 'bad' }), checkedAt: '2026-07-15T00:20:00Z' }), /40-character/);
  assert.throws(() => verifyRuntimeStageFreshnessV3({ stageVerification: stage({ audio_policy_verified: false }), checkedAt: '2026-07-15T00:20:00Z' }), /audio_policy_verified/);
  assert.throws(() => verifyRuntimeStageFreshnessV3({ stageVerification: stage({ side_effects_performed: true }), checkedAt: '2026-07-15T00:20:00Z' }), /side_effects_performed/);
});
