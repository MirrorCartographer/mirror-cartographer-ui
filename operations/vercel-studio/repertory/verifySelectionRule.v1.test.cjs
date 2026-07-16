'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { verifySelectionRule } = require('./verifySelectionRule.v1.cjs');

function validRepertory() {
  return {
    selection_rule: {
      type: 'deterministic_hour_slot',
      expression: 'hour_slots[utc_hour]',
      randomness_permitted: false,
      distinct_hourly_edition_required: true,
      base_production_reuse_permitted: true,
      continuity_state_preserved_across_productions: true,
    },
    hour_slots: Array.from({ length: 24 }, (_, utc_hour) => ({
      utc_hour,
      edition_id: `edition-${String(utc_hour).padStart(2, '0')}`,
      production_id: `production-${utc_hour % 6}`,
      edition_cue: `cue-${utc_hour}`,
    })),
  };
}

test('accepts the canonical deterministic direct hour-slot contract', () => {
  const result = verifySelectionRule(validRepertory());
  assert.equal(result.verified, true);
  assert.equal(result.claim_boundary, 'deterministic_direct_hour_slot_contract_verified');
});

test('rejects the superseded deterministic_modulo rule', () => {
  const repertory = validRepertory();
  repertory.selection_rule.type = 'deterministic_modulo';
  repertory.selection_rule.expression = 'productions[utc_hour % productions.length]';
  const result = verifySelectionRule(repertory);
  assert.equal(result.verified, false);
  assert.deepEqual(result.violations, [
    'unsupported_selection_expression',
    'unsupported_selection_rule_type',
  ]);
});

test('rejects incomplete or ambiguous hourly coverage', () => {
  const repertory = validRepertory();
  repertory.hour_slots[23] = { ...repertory.hour_slots[22] };
  const result = verifySelectionRule(repertory);
  assert.equal(result.verified, false);
  assert.ok(result.violations.includes('duplicate_edition_id'));
  assert.ok(result.violations.includes('duplicate_hour_slot'));
  assert.ok(result.violations.includes('hour_slot_coverage_incomplete'));
});

test('rejects weakened randomness and continuity boundaries', () => {
  const repertory = validRepertory();
  repertory.selection_rule.randomness_permitted = true;
  repertory.selection_rule.continuity_state_preserved_across_productions = false;
  const result = verifySelectionRule(repertory);
  assert.equal(result.verified, false);
  assert.ok(result.violations.includes('randomness_not_prohibited'));
  assert.ok(result.violations.includes('continuity_preservation_not_required'));
});
