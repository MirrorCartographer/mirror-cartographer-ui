'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const repertory = require('./HOURLY_REPERTORY.v1.json');
const { buildProgrammedStageReceipt, repertoryDigest } = require('./buildProgrammedStageReceipt.v1.cjs');
const { verifyProgrammedStageReceipt } = require('./verifyProgrammedStageReceipt.v1.cjs');

const COMMIT = 'e6767437e979f04a2df074642963aac4b603335c';

test('builds a verifier-compatible exact-commit and hourly-edition receipt without activation claims', () => {
  const receipt = buildProgrammedStageReceipt(
    repertory,
    new Date('2026-07-15T04:20:00.000Z'),
    { source_commit: COMMIT },
  );

  assert.equal(receipt.evidence_class, 'commit_and_repertory_bound_programmed_stage_identity_only');
  assert.equal(receipt.utc_hour, 4);
  assert.equal(receipt.programmed_production.id, 'body-constellation');
  assert.deepEqual(receipt.programmed_edition, {
    id: 'body-constellation-04',
    cue: 'shoulder-orbit',
    utc_hour: 4,
  });
  assert.equal(receipt.source_commit, COMMIT);
  assert.equal(receipt.repertory_sha256, repertoryDigest(repertory));
  assert.equal(receipt.exact_commit_bound, true);
  assert.equal(receipt.repertory_content_bound, true);
  assert.equal(receipt.safety_contract_verified, true);
  assert.equal(receipt.continuity_state_preserved, true);

  const verified = verifyProgrammedStageReceipt(receipt, {
    source_commit: COMMIT,
    repertory_sha256: repertoryDigest(repertory),
    utc_hour: 4,
    production_id: 'body-constellation',
    edition_id: 'body-constellation-04',
    edition_cue: 'shoulder-orbit',
  });
  assert.equal(verified.verified, true);
  assert.deepEqual(verified.violations, []);

  for (const field of ['runtime_activation_claimed','deployment_claimed','browser_execution_claimed','audio_playback_claimed','physical_device_verification_claimed','side_effects_performed']) {
    assert.equal(receipt[field], false, field);
  }
});

test('selection advances deterministically to a distinct edition while continuity remains preserved', () => {
  const first = buildProgrammedStageReceipt(repertory, new Date('2026-07-15T04:59:59.000Z'), { source_commit: COMMIT });
  const second = buildProgrammedStageReceipt(repertory, new Date('2026-07-15T05:00:00.000Z'), { source_commit: COMMIT });

  assert.equal(first.programmed_edition.id, 'body-constellation-04');
  assert.equal(second.programmed_edition.id, 'archive-afterimage-05');
  assert.notEqual(first.programmed_edition.id, second.programmed_edition.id);
  assert.equal(first.continuity_state_preserved, true);
  assert.equal(second.continuity_state_preserved, true);
});

test('rejects caller fields that could smuggle activation claims', () => {
  assert.throws(
    () => buildProgrammedStageReceipt(repertory, new Date('2026-07-15T04:20:00.000Z'), { source_commit: COMMIT, runtime_active: true }),
    /unsupported programmed stage receipt field: runtime_active/,
  );
});

test('requires an exact commit binding', () => {
  assert.throws(
    () => buildProgrammedStageReceipt(repertory, new Date('2026-07-15T04:20:00.000Z')),
    /source_commit must be a lowercase 40-character commit SHA/,
  );
  assert.throws(
    () => buildProgrammedStageReceipt(repertory, new Date('2026-07-15T04:20:00.000Z'), { source_commit: 'main' }),
    /source_commit must be a lowercase 40-character commit SHA/,
  );
});

test('fails closed when an hourly slot loses distinct edition identity', () => {
  const mutated = JSON.parse(JSON.stringify(repertory));
  delete mutated.hour_slots[4].edition_id;
  assert.throws(
    () => buildProgrammedStageReceipt(mutated, new Date('2026-07-15T04:20:00.000Z'), { source_commit: COMMIT }),
    /programmed hour slot must declare a non-empty edition_id/,
  );
});
