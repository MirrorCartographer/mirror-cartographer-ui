'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { verifyProgrammedStageFreshness } = require('./verifyProgrammedStageFreshness.v1.cjs');

function receipt(overrides = {}) {
  return {
    schema_version: 1,
    evidence_class: 'commit_and_repertory_bound_programmed_stage_identity_only',
    source_commit: 'a'.repeat(40),
    repertory_sha256: 'b'.repeat(64),
    repertory_contract_id: 'vercel-studio-hourly-repertory-v1',
    exact_commit_bound: true,
    repertory_content_bound: true,
    safety_contract_verified: true,
    continuity_state_preserved: true,
    generated_at: '2026-07-16T00:10:00.000Z',
    utc_hour: 0,
    programmed_production: {
      id: 'residual-comet',
      title: 'Residual Comet',
      form: 'particle_cinematography',
      continuity_role: 'companion_signal',
      repertory_status: 'active',
    },
    programmed_edition: {
      id: 'residual-comet-00',
      cue: 'long-tail-entry',
      utc_hour: 0,
    },
    runtime_activation_claimed: false,
    deployment_claimed: false,
    browser_execution_claimed: false,
    audio_playback_claimed: false,
    physical_device_verification_claimed: false,
    side_effects_performed: false,
    ...overrides,
  };
}

test('accepts a structurally verified current-hour receipt inside the bounded age', () => {
  const result = verifyProgrammedStageFreshness(receipt(), new Date('2026-07-16T00:38:00.000Z'));
  assert.equal(result.verified, true);
  assert.equal(result.receipt_contract_verified, true);
  assert.equal(
    result.claim_boundary,
    'fresh_commit_and_repertory_bound_programmed_stage_identity_only',
  );
});

test('rejects a receipt at the one-hour boundary', () => {
  const result = verifyProgrammedStageFreshness(receipt(), new Date('2026-07-16T01:10:00.000Z'));
  assert.equal(result.verified, false);
  assert.ok(result.violations.includes('receipt_stale'));
  assert.ok(result.violations.includes('programmed_hour_mismatch'));
});

test('rejects future-dated receipts', () => {
  const result = verifyProgrammedStageFreshness(receipt(), new Date('2026-07-15T23:59:00.000Z'));
  assert.equal(result.verified, false);
  assert.ok(result.violations.includes('receipt_from_future'));
});

test('rejects structurally invalid receipts even when their timestamp is fresh', () => {
  const result = verifyProgrammedStageFreshness(receipt({
    exact_commit_bound: false,
    runtime_activation_claimed: true,
  }), new Date('2026-07-16T00:38:00.000Z'));

  assert.equal(result.verified, false);
  assert.equal(result.receipt_contract_verified, false);
  assert.ok(result.violations.includes('receipt_contract_unverified'));
  assert.ok(result.violations.includes('receipt_contract:exact_commit_not_bound'));
  assert.ok(result.violations.includes('receipt_contract:runtime_activation_claimed_must_be_false'));
});

test('passes expected commit and repertory bindings into structural verification', () => {
  const result = verifyProgrammedStageFreshness(receipt(), new Date('2026-07-16T00:38:00.000Z'), {
    expected: {
      source_commit: 'c'.repeat(40),
      repertory_sha256: 'd'.repeat(64),
    },
  });

  assert.equal(result.verified, false);
  assert.ok(result.violations.includes('receipt_contract:source_commit_mismatch'));
  assert.ok(result.violations.includes('receipt_contract:repertory_digest_mismatch'));
});

test('rejects a max age longer than one hour', () => {
  const result = verifyProgrammedStageFreshness(receipt(), new Date('2026-07-16T00:38:00.000Z'), {
    max_age_ms: 60 * 60 * 1000 + 1,
  });
  assert.equal(result.verified, false);
  assert.ok(result.violations.includes('invalid_max_age'));
});
