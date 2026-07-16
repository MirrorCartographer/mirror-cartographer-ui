'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { verifyProgrammedStageFreshness } = require('./verifyProgrammedStageFreshness.v1.cjs');

function receipt(overrides = {}) {
  return {
    generated_at: '2026-07-16T00:10:00.000Z',
    utc_hour: 0,
    runtime_activation_claimed: false,
    deployment_claimed: false,
    side_effects_performed: false,
    ...overrides,
  };
}

test('accepts a current-hour operations-only receipt inside the bounded age', () => {
  const result = verifyProgrammedStageFreshness(receipt(), new Date('2026-07-16T00:38:00.000Z'));
  assert.equal(result.verified, true);
  assert.equal(result.claim_boundary, 'fresh_programmed_stage_identity_only');
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

test('rejects activation deployment or side-effect claims', () => {
  const result = verifyProgrammedStageFreshness(receipt({
    runtime_activation_claimed: true,
    deployment_claimed: true,
    side_effects_performed: true,
  }), new Date('2026-07-16T00:38:00.000Z'));
  assert.deepEqual(result.violations, [
    'deployment_claimed',
    'runtime_activation_claimed',
    'side_effects_claimed',
  ]);
});

test('rejects a max age longer than one hour', () => {
  const result = verifyProgrammedStageFreshness(receipt(), new Date('2026-07-16T00:38:00.000Z'), {
    max_age_ms: 60 * 60 * 1000 + 1,
  });
  assert.equal(result.verified, false);
  assert.ok(result.violations.includes('invalid_max_age'));
});
