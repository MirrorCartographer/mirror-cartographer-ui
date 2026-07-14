'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  verifyHourlyContinuityCycle,
} = require('./verifyHourlyContinuityCycle.v1.cjs');

const repertory = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'HOURLY_REPERTORY.v1.json'), 'utf8'),
);

const seedState = {
  continuity_revision: 1,
  companion_signal: {
    x: 0.375,
    y: 0.625,
    visible: true,
  },
  language_field: ['north', 'return', 'afterimage'],
  visitor_mode: 'non_identifying_public_session',
};

test('verifies all 24 hourly transitions including the UTC day boundary', () => {
  const report = verifyHourlyContinuityCycle(repertory, seedState);

  assert.equal(report.verified, true);
  assert.equal(report.hours_covered, 24);
  assert.equal(report.includes_day_boundary, true);
  assert.equal(report.transitions.length, 24);
  assert.deepEqual(report.transitions.at(-1), {
    from_utc_hour: 23,
    to_utc_hour: 0,
    from_production_id: 'archive-afterimage',
    to_production_id: 'residual-comet',
    production_changed: true,
    continuity_state_preserved: true,
    side_effects_performed: false,
  });
});

test('preserves the seed state without mutating the caller-owned object', () => {
  const before = structuredClone(seedState);
  const report = verifyHourlyContinuityCycle(repertory, seedState);

  assert.deepEqual(seedState, before);
  assert.equal(report.continuity_state_preserved, true);
  assert.equal(report.side_effects_performed, false);
  assert.equal(Object.isFrozen(report), true);
  assert.equal(Object.isFrozen(report.transitions), true);
});

test('rejects continuity state that crosses the public privacy boundary', () => {
  assert.throws(
    () => verifyHourlyContinuityCycle(repertory, { token: 'must-not-enter-public-state' }),
    /not permitted in public continuity state/,
  );
});

test('fails closed when the deterministic hour schedule is altered', () => {
  const altered = structuredClone(repertory);
  altered.hour_slots[0].production_id = 'quiet-machine';

  assert.throws(
    () => verifyHourlyContinuityCycle(altered, seedState),
    /violates deterministic modulo rule/,
  );
});
