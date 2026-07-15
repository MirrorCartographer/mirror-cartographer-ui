'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const repertory = require('./HOURLY_REPERTORY.v1.json');
const { buildProgrammedStageReceipt } = require('./buildProgrammedStageReceipt.v1.cjs');

const COMMIT = 'e6767437e979f04a2df074642963aac4b603335c';

test('identifies the UTC-hour production without claiming runtime activation', () => {
  const receipt = buildProgrammedStageReceipt(
    repertory,
    new Date('2026-07-15T04:20:00.000Z'),
    { source_commit: COMMIT },
  );

  assert.equal(receipt.evidence_class, 'deterministic_programmed_stage_identity_only');
  assert.equal(receipt.utc_hour, 4);
  assert.equal(receipt.programmed_production.id, 'body-constellation');
  assert.equal(receipt.source_commit, COMMIT);
  assert.equal(receipt.safety_contract_verified, true);
  assert.equal(receipt.continuity_state_preserved, true);
  assert.equal(receipt.runtime_activation_claimed, false);
  assert.equal(receipt.deployment_claimed, false);
  assert.equal(receipt.browser_execution_claimed, false);
  assert.equal(receipt.audio_playback_claimed, false);
  assert.equal(receipt.physical_device_verification_claimed, false);
  assert.equal(receipt.side_effects_performed, false);
});

test('selection advances deterministically while continuity remains preserved', () => {
  const first = buildProgrammedStageReceipt(repertory, new Date('2026-07-15T04:59:59.000Z'));
  const second = buildProgrammedStageReceipt(repertory, new Date('2026-07-15T05:00:00.000Z'));

  assert.equal(first.programmed_production.id, 'body-constellation');
  assert.equal(second.programmed_production.id, 'archive-afterimage');
  assert.equal(first.continuity_state_preserved, true);
  assert.equal(second.continuity_state_preserved, true);
});

test('rejects caller fields that could smuggle activation claims', () => {
  assert.throws(
    () => buildProgrammedStageReceipt(
      repertory,
      new Date('2026-07-15T04:20:00.000Z'),
      { runtime_active: true },
    ),
    /unsupported programmed stage receipt field: runtime_active/,
  );
});

test('rejects non-canonical commit identifiers', () => {
  assert.throws(
    () => buildProgrammedStageReceipt(
      repertory,
      new Date('2026-07-15T04:20:00.000Z'),
      { source_commit: 'main' },
    ),
    /source_commit must be a lowercase 40-character commit SHA/,
  );
});
