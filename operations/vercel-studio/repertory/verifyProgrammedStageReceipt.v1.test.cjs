'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { verifyProgrammedStageReceipt } = require('./verifyProgrammedStageReceipt.v1.cjs');
const base = {
  schema_version: 1,
  evidence_class: 'commit_and_repertory_bound_programmed_stage_identity_only',
  source_commit: 'a'.repeat(40),
  repertory_sha256: 'b'.repeat(64),
  exact_commit_bound: true,
  repertory_content_bound: true,
  safety_contract_verified: true,
  continuity_state_preserved: true,
  utc_hour: 11,
  programmed_production: { id: 'archive-afterimage' },
  programmed_edition: { id: 'archive-afterimage-11', cue: 'negative-room', utc_hour: 11 },
  runtime_activation_claimed: false,
  deployment_claimed: false,
  browser_execution_claimed: false,
  audio_playback_claimed: false,
  physical_device_verification_claimed: false,
  side_effects_performed: false,
};

test('accepts an exact-commit, repertory, production, and hourly-edition bound non-activation receipt', () => {
  const result = verifyProgrammedStageReceipt(base, {
    source_commit: 'a'.repeat(40),
    repertory_sha256: 'b'.repeat(64),
    utc_hour: 11,
    production_id: 'archive-afterimage',
    edition_id: 'archive-afterimage-11',
    edition_cue: 'negative-room',
  });
  assert.equal(result.verified, true);
  assert.equal(result.edition_id, 'archive-afterimage-11');
  assert.equal(result.edition_cue, 'negative-room');
  assert.deepEqual(result.violations, []);
});

test('fails closed when any runtime or deployment claim is smuggled into the receipt', () => {
  for (const field of ['runtime_activation_claimed','deployment_claimed','browser_execution_claimed','audio_playback_claimed','physical_device_verification_claimed','side_effects_performed']) {
    const result = verifyProgrammedStageReceipt({ ...base, [field]: true });
    assert.equal(result.verified, false, field);
    assert.ok(result.violations.includes(`${field}_must_be_false`), field);
  }
});

test('rejects edition identity drift even when the base production still matches', () => {
  const result = verifyProgrammedStageReceipt({
    ...base,
    programmed_edition: { id: 'archive-afterimage-23', cue: 'closing-trace', utc_hour: 23 },
  }, {
    utc_hour: 11,
    production_id: 'archive-afterimage',
    edition_id: 'archive-afterimage-11',
    edition_cue: 'negative-room',
  });
  for (const expected of ['edition_hour_mismatch','edition_id_mismatch','edition_cue_mismatch']) {
    assert.ok(result.violations.includes(expected), expected);
  }
  assert.ok(!result.violations.includes('production_id_mismatch'));
});

test('rejects malformed evidence and missing edition identity', () => {
  const malformed = { ...base, source_commit: 'main', repertory_sha256: 'x', utc_hour: 24 };
  delete malformed.programmed_edition;
  const result = verifyProgrammedStageReceipt(malformed, {
    source_commit: 'c'.repeat(40),
    repertory_sha256: 'd'.repeat(64),
    utc_hour: 11,
    production_id: 'quiet-machine',
    edition_id: 'quiet-machine-11',
    edition_cue: 'visible-idle',
  });
  for (const expected of ['invalid_source_commit','invalid_repertory_digest','invalid_utc_hour','missing_programmed_edition','missing_programmed_edition_cue','edition_hour_mismatch','source_commit_mismatch','repertory_digest_mismatch','utc_hour_mismatch','production_id_mismatch','edition_id_mismatch','edition_cue_mismatch']) {
    assert.ok(result.violations.includes(expected), expected);
  }
});
