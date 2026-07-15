'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { validateDurableRepertoryProvenance } = require('./validateDurableRepertoryProvenance.v1.cjs');

const repertoryPath = join(__dirname, 'HOURLY_REPERTORY.v1.json');

function loadCanonicalRepertory() {
  return JSON.parse(readFileSync(repertoryPath, 'utf8'));
}

test('canonical repertory satisfies durable provenance and deterministic scheduling contracts', () => {
  const repertory = loadCanonicalRepertory();
  const provenance = validateDurableRepertoryProvenance(repertory);

  assert.equal(provenance.valid, true, JSON.stringify(provenance.violations));
  assert.equal(provenance.production_count, repertory.productions.length);
  assert.equal(provenance.activation_claimed, false);
  assert.equal(provenance.deployment_claimed, false);

  assert.equal(repertory.selection_rule.type, 'deterministic_hour_slot');
  assert.equal(repertory.selection_rule.expression, 'hour_slots[utc_hour]');
  assert.equal(repertory.selection_rule.randomness_permitted, false);
  assert.equal(repertory.selection_rule.distinct_hourly_edition_required, true);
  assert.equal(repertory.selection_rule.base_production_reuse_permitted, true);
  assert.equal(repertory.selection_rule.continuity_state_preserved_across_productions, true);

  assert.equal(repertory.hour_slots.length, 24);
  assert.deepEqual(repertory.hour_slots.map(({ utc_hour }) => utc_hour), [...Array(24).keys()]);

  const productionIds = new Set(repertory.productions.map(({ id }) => id));
  const editionIds = new Set();
  for (const slot of repertory.hour_slots) {
    assert.equal(productionIds.has(slot.production_id), true, `unknown production for UTC hour ${slot.utc_hour}`);
    assert.match(slot.edition_id, /^[a-z0-9]+(?:-[a-z0-9]+)*-(?:0\d|1\d|2[0-3])$/);
    assert.equal(slot.edition_id.endsWith(String(slot.utc_hour).padStart(2, '0')), true);
    assert.equal(editionIds.has(slot.edition_id), false, `duplicate edition for UTC hour ${slot.utc_hour}`);
    assert.equal(typeof slot.edition_cue, 'string');
    assert.notEqual(slot.edition_cue.trim(), '');
    editionIds.add(slot.edition_id);
  }
  assert.equal(editionIds.size, 24);

  assert.equal(repertory.global_runtime_constraints.audio, 'explicit_user_gesture_only');
  assert.equal(repertory.global_runtime_constraints.motion, 'honor_prefers_reduced_motion');
  assert.equal(repertory.global_runtime_constraints.mobile, 'viewport_safe_and_touch_safe');
  assert.equal(repertory.global_runtime_constraints.accessibility, 'keyboard_operable_with_nonvisual_status_equivalent');
  assert.equal(repertory.global_runtime_constraints.performance, 'no_required_network_media_for_first_interaction');
  assert.equal(repertory.global_runtime_constraints.privacy, 'no_private_source_material');
  assert.equal(repertory.global_runtime_constraints.commerce, 'no_payments_or_conversion_logic');
  assert.equal(repertory.activation_boundary.runtime_integration, 'not_performed');
});