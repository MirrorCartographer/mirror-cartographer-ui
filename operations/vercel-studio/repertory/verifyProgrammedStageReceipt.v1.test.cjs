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
  runtime_activation_claimed: false,
  deployment_claimed: false,
  browser_execution_claimed: false,
  audio_playback_claimed: false,
  physical_device_verification_claimed: false,
  side_effects_performed: false,
};

test('accepts an exact-commit and repertory-bound non-activation receipt', () => {
  const result = verifyProgrammedStageReceipt(base, {
    source_commit: 'a'.repeat(40), repertory_sha256: 'b'.repeat(64), utc_hour: 11, production_id: 'archive-afterimage',
  });
  assert.equal(result.verified, true);
  assert.deepEqual(result.violations, []);
});

test('fails closed when any runtime or deployment claim is smuggled into the receipt', () => {
  for (const field of ['runtime_activation_claimed','deployment_claimed','browser_execution_claimed','audio_playback_claimed','physical_device_verification_claimed','side_effects_performed']) {
    const result = verifyProgrammedStageReceipt({ ...base, [field]: true });
    assert.equal(result.verified, false, field);
    assert.ok(result.violations.includes(`${field}_must_be_false`), field);
  }
});

test('rejects identity drift and malformed evidence', () => {
  const result = verifyProgrammedStageReceipt({ ...base, source_commit: 'main', repertory_sha256: 'x', utc_hour: 24 }, {
    source_commit: 'c'.repeat(40), repertory_sha256: 'd'.repeat(64), utc_hour: 11, production_id: 'quiet-machine',
  });
  for (const expected of ['invalid_source_commit','invalid_repertory_digest','invalid_utc_hour','source_commit_mismatch','repertory_digest_mismatch','utc_hour_mismatch','production_id_mismatch']) {
    assert.ok(result.violations.includes(expected), expected);
  }
});
