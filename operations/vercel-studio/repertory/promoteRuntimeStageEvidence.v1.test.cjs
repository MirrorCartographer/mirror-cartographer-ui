'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { promoteRuntimeStageEvidenceV1 } = require('./promoteRuntimeStageEvidence.v1.cjs');

const base = {
  contract_id: 'vercel-studio-runtime-stage-verification-v1',
  verified: true,
  classification: 'commit_bound_runtime_stage_verified',
  production_id: 'coordinate-choir',
  commit_sha: 'a'.repeat(40),
  deployment_id: 'dpl_1',
  deployment_url: 'https://example.vercel.app/',
  repertory_contract_id: 'hourly-repertory-v1',
  audio_policy_verified: true,
  privacy_boundary_verified: true,
  side_effects_performed: false,
  observed_at: '2026-07-15T01:40:00.000Z',
};

const expected = {
  production_id: 'coordinate-choir',
  repertory_contract_id: 'hourly-repertory-v1',
  repertory_hour_utc: 1,
};

test('promotes exact expected identity in current hour', () => {
  const result = promoteRuntimeStageEvidenceV1({
    stageVerification: base,
    checkedAt: '2026-07-15T01:50:00Z',
    expectedStage: expected,
  });
  assert.equal(result.classification, 'commit_bound_runtime_stage_promotable_expected_identity');
  assert.deepEqual(result.expected_stage, expected);
});

test('rejects wrong production', () => {
  assert.throws(() => promoteRuntimeStageEvidenceV1({
    stageVerification: base,
    checkedAt: '2026-07-15T01:50:00Z',
    expectedStage: { ...expected, production_id: 'other' },
  }), /production_id/);
});

test('rejects wrong repertory contract', () => {
  assert.throws(() => promoteRuntimeStageEvidenceV1({
    stageVerification: base,
    checkedAt: '2026-07-15T01:50:00Z',
    expectedStage: { ...expected, repertory_contract_id: 'v2' },
  }), /repertory_contract_id/);
});

test('rejects wrong expected hour', () => {
  assert.throws(() => promoteRuntimeStageEvidenceV1({
    stageVerification: base,
    checkedAt: '2026-07-15T01:50:00Z',
    expectedStage: { ...expected, repertory_hour_utc: 2 },
  }), /hour/);
});

test('preserves current-hour expiry rejection', () => {
  assert.throws(() => promoteRuntimeStageEvidenceV1({
    stageVerification: base,
    checkedAt: '2026-07-15T02:00:00Z',
    expectedStage: expected,
  }), /previous deterministic repertory hour/);
});

test('rejects invalid hour declaration', () => {
  assert.throws(() => promoteRuntimeStageEvidenceV1({
    stageVerification: base,
    checkedAt: '2026-07-15T01:50:00Z',
    expectedStage: { ...expected, repertory_hour_utc: 24 },
  }), /0 through 23/);
});
