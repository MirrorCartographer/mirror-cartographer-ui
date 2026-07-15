'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { ingestRuntimeStageEvidenceV1 } = require('./ingestRuntimeStageEvidence.v1.cjs');

const productions = ['residual-comet','coordinate-choir','quiet-machine','wordless-room-game','body-constellation','archive-afterimage'].map((id) => ({ id, title: id, form: 'test', continuity_role: 'test', status: 'proposed' }));
const repertory = {
  contract_id: 'vercel-studio-hourly-repertory-v1',
  productions,
  hour_slots: Array.from({ length: 24 }, (_, utc_hour) => ({ utc_hour, production_id: productions[utc_hour % productions.length].id })),
};
const stageVerification = {
  contract_id: 'vercel-studio-runtime-stage-verification-v1',
  verified: true,
  classification: 'commit_bound_runtime_stage_verified',
  production_id: 'wordless-room-game',
  commit_sha: 'a'.repeat(40),
  deployment_id: 'dpl_1',
  deployment_url: 'https://example.vercel.app/',
  repertory_contract_id: 'vercel-studio-hourly-repertory-v1',
  audio_policy_verified: true,
  privacy_boundary_verified: true,
  side_effects_performed: false,
  observed_at: '2026-07-15T03:10:00.000Z',
};

test('ingests only selector-derived canonical identity', () => {
  const result = ingestRuntimeStageEvidenceV1({ stageVerification, checkedAt: '2026-07-15T03:11:00Z', repertory });
  assert.equal(result.classification, 'canonical_repertory_runtime_stage_ingested');
  assert.equal(result.expected_stage.production_id, 'wordless-room-game');
  assert.equal(result.ingestion_boundary, 'repertory_derived_identity_only');
});

test('rejects caller-supplied expectedStage', () => {
  assert.throws(() => ingestRuntimeStageEvidenceV1({ stageVerification, checkedAt: '2026-07-15T03:11:00Z', repertory, expectedStage: {} }), /unsupported|forbidden/);
});

test('rejects snake-case caller-supplied expected stage', () => {
  assert.throws(() => ingestRuntimeStageEvidenceV1({ stageVerification, checkedAt: '2026-07-15T03:11:00Z', repertory, expected_stage: {} }), /unsupported|forbidden/);
});

test('rejects unknown ingestion fields', () => {
  assert.throws(() => ingestRuntimeStageEvidenceV1({ stageVerification, checkedAt: '2026-07-15T03:11:00Z', repertory, bypass: true }), /unsupported/);
});

test('fails closed when runtime evidence names a non-canonical production', () => {
  assert.throws(() => ingestRuntimeStageEvidenceV1({ stageVerification: { ...stageVerification, production_id: 'quiet-machine' }, checkedAt: '2026-07-15T03:11:00Z', repertory }), /production_id/);
});
