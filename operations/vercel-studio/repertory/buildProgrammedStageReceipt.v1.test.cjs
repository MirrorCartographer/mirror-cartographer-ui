'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const repertory = require('./HOURLY_REPERTORY.v1.json');
const { buildProgrammedStageReceipt, repertoryDigest } = require('./buildProgrammedStageReceipt.v1.cjs');
const { verifyProgrammedStageReceipt } = require('./verifyProgrammedStageReceipt.v1.cjs');

const COMMIT = 'e6767437e979f04a2df074642963aac4b603335c';
const GENERATED_AT = '2026-07-15T04:20:00.000Z';

function validReceipt() {
  return buildProgrammedStageReceipt(repertory, new Date(GENERATED_AT), { source_commit: COMMIT });
}

test('builds a verifier-compatible exact-commit and hourly-edition receipt without activation claims', () => {
  const receipt = validReceipt();

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
    repertory_contract_id: repertory.contract_id,
    generated_at: GENERATED_AT,
    utc_hour: 4,
    production_id: 'body-constellation',
    production_title: 'Body Constellation',
    production_form: 'accessible_spatial_map',
    production_continuity_role: 'embodied_navigation',
    production_repertory_status: 'proposed',
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
    () => buildProgrammedStageReceipt(repertory, new Date(GENERATED_AT), { source_commit: COMMIT, runtime_active: true }),
    /unsupported programmed stage receipt field: runtime_active/,
  );
});

test('requires an exact commit binding', () => {
  assert.throws(
    () => buildProgrammedStageReceipt(repertory, new Date(GENERATED_AT)),
    /source_commit must be a lowercase 40-character commit SHA/,
  );
  assert.throws(
    () => buildProgrammedStageReceipt(repertory, new Date(GENERATED_AT), { source_commit: 'main' }),
    /source_commit must be a lowercase 40-character commit SHA/,
  );
});

test('fails closed when an hourly slot loses distinct edition identity', () => {
  const mutated = JSON.parse(JSON.stringify(repertory));
  delete mutated.hour_slots[4].edition_id;
  assert.throws(
    () => buildProgrammedStageReceipt(mutated, new Date(GENERATED_AT), { source_commit: COMMIT }),
    /programmed hour slot must declare a non-empty edition_id/,
  );
});

test('fails closed when generated_at is missing, non-canonical, or names a different UTC hour', () => {
  const missing = { ...validReceipt() };
  delete missing.generated_at;
  assert.deepEqual(verifyProgrammedStageReceipt(missing).violations, ['invalid_generated_at']);

  const nonCanonical = { ...validReceipt(), generated_at: '2026-07-15T04:20:00Z' };
  assert.deepEqual(verifyProgrammedStageReceipt(nonCanonical).violations, ['invalid_generated_at']);

  const drifted = { ...validReceipt(), generated_at: '2026-07-15T05:20:00.000Z' };
  assert.deepEqual(verifyProgrammedStageReceipt(drifted).violations, ['generated_at_hour_mismatch']);
});

test('fails closed on repertory contract or expected instant mismatch', () => {
  const receipt = validReceipt();
  const verified = verifyProgrammedStageReceipt(receipt, {
    repertory_contract_id: 'wrong-contract',
    generated_at: '2026-07-15T04:21:00.000Z',
  });
  assert.equal(verified.verified, false);
  assert.deepEqual(verified.violations, [
    'repertory_contract_id_mismatch',
    'generated_at_mismatch',
  ]);
});

test('fails closed when programmed production metadata is missing or differs from the expected repertory identity', () => {
  const missing = {
    ...validReceipt(),
    programmed_production: {
      ...validReceipt().programmed_production,
      form: '',
    },
  };
  assert.deepEqual(verifyProgrammedStageReceipt(missing).violations, [
    'missing_programmed_production_form',
  ]);

  const receipt = validReceipt();
  const verified = verifyProgrammedStageReceipt(receipt, {
    production_title: 'Body Constellation (tampered)',
    production_form: 'dashboard',
    production_continuity_role: 'private_source_exposure',
    production_repertory_status: 'active_deployment',
  });
  assert.equal(verified.verified, false);
  assert.deepEqual(verified.violations, [
    'production_title_mismatch',
    'production_form_mismatch',
    'production_continuity_role_mismatch',
    'production_repertory_status_mismatch',
  ]);
});