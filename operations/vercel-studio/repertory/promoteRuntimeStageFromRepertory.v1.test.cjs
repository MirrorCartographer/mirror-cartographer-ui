'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { promoteRuntimeStageFromRepertoryV1 } = require('./promoteRuntimeStageFromRepertory.v1.cjs');

const ids = [
  'residual-comet',
  'coordinate-choir',
  'quiet-machine',
  'wordless-room-game',
  'body-constellation',
  'archive-afterimage',
];
const productions = ids.map((id, index) => ({
  id,
  title: `Production ${index}`,
  form: 'test-form',
  continuity_role: 'test-role',
  status: 'proposed',
}));
const repertory = {
  contract_id: 'vercel-studio-hourly-repertory-v1',
  productions,
  hour_slots: Array.from({ length: 24 }, (_, utc_hour) => ({
    utc_hour,
    production_id: productions[utc_hour % productions.length].id,
  })),
};
const base = {
  contract_id: 'vercel-studio-runtime-stage-verification-v1',
  verified: true,
  classification: 'commit_bound_runtime_stage_verified',
  production_id: 'coordinate-choir',
  commit_sha: 'a'.repeat(40),
  deployment_id: 'dpl_1',
  deployment_url: 'https://example.vercel.app/',
  repertory_contract_id: 'vercel-studio-hourly-repertory-v1',
  audio_policy_verified: true,
  privacy_boundary_verified: true,
  side_effects_performed: false,
  observed_at: '2026-07-15T01:40:00.000Z',
};

test('derives and promotes the canonical selected stage', () => {
  const result = promoteRuntimeStageFromRepertoryV1({
    stageVerification: base,
    checkedAt: '2026-07-15T01:50:00Z',
    repertory,
  });
  assert.equal(result.classification, 'commit_bound_runtime_stage_promotable_canonical_repertory');
  assert.equal(result.repertory_selection.production_id, 'coordinate-choir');
  assert.deepEqual(result.expected_stage, {
    production_id: 'coordinate-choir',
    repertory_contract_id: 'vercel-studio-hourly-repertory-v1',
    repertory_hour_utc: 1,
  });
});

test('rejects runtime production inconsistent with selector', () => {
  assert.throws(() => promoteRuntimeStageFromRepertoryV1({
    stageVerification: { ...base, production_id: 'quiet-machine' },
    checkedAt: '2026-07-15T01:50:00Z',
    repertory,
  }), /production_id/);
});

test('rejects runtime repertory contract inconsistent with canonical repertory', () => {
  assert.throws(() => promoteRuntimeStageFromRepertoryV1({
    stageVerification: { ...base, repertory_contract_id: 'other' },
    checkedAt: '2026-07-15T01:50:00Z',
    repertory,
  }), /repertory_contract_id/);
});

test('rejects checked hour after observed hour', () => {
  assert.throws(() => promoteRuntimeStageFromRepertoryV1({
    stageVerification: base,
    checkedAt: '2026-07-15T02:00:00Z',
    repertory,
  }), /previous deterministic repertory hour/);
});

test('rejects malformed repertory before promotion', () => {
  assert.throws(() => promoteRuntimeStageFromRepertoryV1({
    stageVerification: base,
    checkedAt: '2026-07-15T01:50:00Z',
    repertory: { ...repertory, hour_slots: repertory.hour_slots.slice(1) },
  }), /exactly 24/);
});

test('rejects missing canonical contract id', () => {
  assert.throws(() => promoteRuntimeStageFromRepertoryV1({
    stageVerification: base,
    checkedAt: '2026-07-15T01:50:00Z',
    repertory: { ...repertory, contract_id: '' },
  }), /contract_id/);
});
