'use strict';

const SUPPORTED_RULE = Object.freeze({
  type: 'deterministic_hour_slot',
  expression: 'hour_slots[utc_hour]',
});

function verifySelectionRule(repertory) {
  const violations = [];

  if (!repertory || typeof repertory !== 'object' || Array.isArray(repertory)) {
    violations.push('invalid_repertory');
  }

  const rule = repertory && typeof repertory === 'object' ? repertory.selection_rule : null;
  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
    violations.push('missing_selection_rule');
  } else {
    if (rule.type !== SUPPORTED_RULE.type) violations.push('unsupported_selection_rule_type');
    if (rule.expression !== SUPPORTED_RULE.expression) violations.push('unsupported_selection_expression');
    if (rule.randomness_permitted !== false) violations.push('randomness_not_prohibited');
    if (rule.distinct_hourly_edition_required !== true) violations.push('distinct_hourly_edition_not_required');
    if (rule.continuity_state_preserved_across_productions !== true) {
      violations.push('continuity_preservation_not_required');
    }
  }

  const slots = repertory && Array.isArray(repertory.hour_slots) ? repertory.hour_slots : [];
  if (slots.length !== 24) violations.push('hour_slot_count_not_24');

  const hours = slots.map((slot) => slot && slot.utc_hour);
  const expectedHours = Array.from({ length: 24 }, (_, index) => index);
  if (hours.length === 24 && expectedHours.some((hour) => !hours.includes(hour))) {
    violations.push('hour_slot_coverage_incomplete');
  }
  if (new Set(hours).size !== hours.length) violations.push('duplicate_hour_slot');

  const editionIds = slots.map((slot) => slot && slot.edition_id);
  if (editionIds.some((id) => typeof id !== 'string' || id.trim() === '')) {
    violations.push('invalid_edition_id');
  }
  if (new Set(editionIds).size !== editionIds.length) violations.push('duplicate_edition_id');

  const uniqueViolations = [...new Set(violations)].sort();
  return Object.freeze({
    schema_version: 1,
    verified: uniqueViolations.length === 0,
    supported_rule: SUPPORTED_RULE,
    slot_count: slots.length,
    violations: Object.freeze(uniqueViolations),
    claim_boundary: uniqueViolations.length === 0
      ? 'deterministic_direct_hour_slot_contract_verified'
      : 'repertory_selection_claim_prohibited',
  });
}

module.exports = { SUPPORTED_RULE, verifySelectionRule };
