'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  transitionHourlyProduction,
  validatePublicContinuityState,
} = require('./transitionHourlyProduction.v1.cjs');

const repertory = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'HOURLY_REPERTORY.v1.json'), 'utf8'),
);

test('preserves one continuity state across an hourly production change', () => {
  const source = {
    companion_signal: { x: 0.25, y: 0.75 },
    visitor_path: ['threshold', 'center'],
    reduced_motion: true,
  };

  const transition = transitionHourlyProduction(repertory, source, 21, 22);

  assert.equal(transition.from.production_id, 'wordless-room-game');
  assert.equal(transition.to.production_id, 'body-constellation');
  assert.equal(transition.production_changed, true);
  assert.equal(transition.continuity_state_preserved, true);
  assert.equal(transition.side_effects_performed, false);
  assert.deepEqual(transition.continuity_state, source);
  assert.notEqual(transition.continuity_state, source);
  assert.ok(Object.isFrozen(transition));
  assert.ok(Object.isFrozen(transition.continuity_state));
  assert.ok(Object.isFrozen(transition.continuity_state.companion_signal));
});

test('does not mutate the caller state', () => {
  const source = { marker: { frame: 12 } };
  const transition = transitionHourlyProduction(repertory, source, 22, 23);
  source.marker.frame = 99;
  assert.equal(transition.continuity_state.marker.frame, 12);
});

test('records no change when two hours resolve to the same production', () => {
  const transition = transitionHourlyProduction(repertory, { trace: 'public-safe' }, 0, 6);
  assert.equal(transition.from.production_id, 'residual-comet');
  assert.equal(transition.to.production_id, 'residual-comet');
  assert.equal(transition.production_changed, false);
});

test('fails closed for private, credential, or commerce-shaped keys', () => {
  for (const key of ['email', 'password', 'token', 'private_source_material', 'payment', 'checkout']) {
    assert.throws(
      () => validatePublicContinuityState({ [key]: 'redacted' }),
      /not permitted in public continuity state/,
    );
  }
});

test('fails closed for nested prohibited keys and non-JSON-safe values', () => {
  assert.throws(
    () => validatePublicContinuityState({ nested: { secret: 'x' } }),
    /not permitted in public continuity state/,
  );
  assert.throws(() => validatePublicContinuityState({ value: Infinity }), /must be finite/);
  assert.throws(() => validatePublicContinuityState({ value: undefined }), /must be JSON-safe/);
});

test('transition implementation performs no activation side effects', () => {
  const source = fs.readFileSync(
    path.join(__dirname, 'transitionHourlyProduction.v1.cjs'),
    'utf8',
  );
  for (const pattern of [
    /fetch\s*\(/,
    /XMLHttpRequest/,
    /AudioContext/,
    /localStorage/,
    /sessionStorage/,
    /document\./,
    /window\./,
  ]) {
    assert.doesNotMatch(source, pattern);
  }
});
