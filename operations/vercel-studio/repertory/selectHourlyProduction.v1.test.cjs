'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { selectForDate, selectHourlyProduction, validateRepertory } = require('./selectHourlyProduction.v1.cjs');

const repertoryPath = path.join(__dirname, 'HOURLY_REPERTORY.v1.json');
const repertory = JSON.parse(fs.readFileSync(repertoryPath, 'utf8'));

test('validates the canonical 24-hour direct hour-slot repertory', () => {
  assert.equal(validateRepertory(repertory), true);
});

test('uses each declared hour slot rather than recomputing a modulo sequence', () => {
  for (let hour = 0; hour < 24; hour += 1) {
    const slot = repertory.hour_slots.find((candidate) => candidate.utc_hour === hour);
    const selected = selectHourlyProduction(repertory, hour);
    assert.equal(selected.production_id, slot.production_id);
    assert.equal(selected.edition_id, slot.edition_id);
    assert.equal(selected.edition_cue, slot.edition_cue);
  }
});

test('scheduled Wordless Room Game slot is not mislabeled as observed runtime state', () => {
  const selected = selectHourlyProduction(repertory, 21);
  assert.deepEqual(selected, {
    utc_hour: 21,
    edition_id: 'wordless-room-game-21',
    edition_cue: 'threshold-four',
    production_id: 'wordless-room-game',
    title: 'Wordless Room Game',
    form: 'interactive_room',
    continuity_role: 'public_screening_candidate',
    status: 'repertory_contract_only',
  });
});

test('uses UTC rather than host-local time', () => {
  const selected = selectForDate(repertory, new Date('2026-07-14T21:59:44.000Z'));
  assert.equal(selected.production_id, 'wordless-room-game');
  assert.equal(selected.status, 'repertory_contract_only');
});

test('fails closed for invalid hours', () => {
  for (const hour of [-1, 24, 1.5, '21', null]) {
    assert.throws(() => selectHourlyProduction(repertory, hour), RangeError);
  }
});

test('fails closed for unknown production references', () => {
  const invalid = structuredClone(repertory);
  invalid.hour_slots[0].production_id = 'not-in-repertory';
  assert.throws(() => validateRepertory(invalid), /unknown production_id/);
});

test('fails closed for duplicate hours or edition identities', () => {
  const duplicateHour = structuredClone(repertory);
  duplicateHour.hour_slots[23].utc_hour = 22;
  assert.throws(() => validateRepertory(duplicateHour), /duplicate utc_hour/);
  const duplicateEdition = structuredClone(repertory);
  duplicateEdition.hour_slots[23].edition_id = duplicateEdition.hour_slots[22].edition_id;
  assert.throws(() => validateRepertory(duplicateEdition), /duplicate edition_id/);
});

test('reference implementation has no activation side effects', () => {
  const source = fs.readFileSync(path.join(__dirname, 'selectHourlyProduction.v1.cjs'), 'utf8');
  const prohibited = [/fetch\s*\(/, /XMLHttpRequest/, /AudioContext/, /localStorage/, /sessionStorage/, /document\./, /window\./, /payment/i, /checkout/i];
  for (const pattern of prohibited) assert.doesNotMatch(source, pattern);
});
