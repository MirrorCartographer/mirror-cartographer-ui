'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  selectForDate,
  selectHourlyProduction,
  validateRepertory,
} = require('./selectHourlyProduction.v1.cjs');

const repertoryPath = path.join(__dirname, 'HOURLY_REPERTORY.v1.json');
const repertory = JSON.parse(fs.readFileSync(repertoryPath, 'utf8'));

test('validates the canonical 24-hour deterministic repertory', () => {
  assert.equal(validateRepertory(repertory), true);
});

test('maps all UTC hours through their explicit edition slots', () => {
  for (let hour = 0; hour < 24; hour += 1) {
    const declared = repertory.hour_slots.find((slot) => slot.utc_hour === hour);
    const selected = selectHourlyProduction(repertory, hour);
    assert.equal(selected.production_id, declared.production_id);
  }
});

test('selects Wordless Room Game for UTC hour 21', () => {
  const selected = selectHourlyProduction(repertory, 21);
  assert.deepEqual(selected, {
    utc_hour: 21,
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

test('uses the declared mapping even when it differs from the old modulo pattern', () => {
  const revised = structuredClone(repertory);
  revised.hour_slots[0].production_id = 'coordinate-choir';
  assert.equal(validateRepertory(revised), true);
  assert.equal(selectHourlyProduction(revised, 0).production_id, 'coordinate-choir');
});

test('reference implementation has no activation side effects', () => {
  const source = fs.readFileSync(
    path.join(__dirname, 'selectHourlyProduction.v1.cjs'),
    'utf8',
  );
  const prohibited = [
    /fetch\s*\(/,
    /XMLHttpRequest/,
    /AudioContext/,
    /localStorage/,
    /sessionStorage/,
    /document\./,
    /window\./,
    /payment/i,
    /checkout/i,
  ];

  for (const pattern of prohibited) {
    assert.doesNotMatch(source, pattern);
  }
});
