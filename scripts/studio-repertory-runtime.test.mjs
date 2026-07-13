import assert from 'node:assert/strict';
import test from 'node:test';
import {
  STUDIO_REPERTORY,
  millisecondsToNextHour,
  productionAt,
  repertoryIndexAt,
} from '../src/engine/studioRepertoryRuntime.js';

const HOUR = 60 * 60 * 1000;

test('the repertory contains distinct complete productions', () => {
  assert.equal(STUDIO_REPERTORY.length, 8);
  assert.equal(new Set(STUDIO_REPERTORY.map(({ id }) => id)).size, STUDIO_REPERTORY.length);
  for (const production of STUDIO_REPERTORY) {
    assert.ok(production.id);
    assert.ok(production.film);
    assert.ok(production.mode);
    assert.ok(production.tempo);
  }
});

test('the same absolute hour always selects the same production', () => {
  const withinHour = Date.UTC(2026, 6, 13, 18, 41, 12);
  assert.equal(productionAt(withinHour).id, productionAt(withinHour + 18 * 60 * 1000).id);
  assert.equal(repertoryIndexAt(withinHour), repertoryIndexAt(withinHour + 18 * 60 * 1000));
});

test('the next hour advances exactly one production and wraps', () => {
  for (let index = 0; index < STUDIO_REPERTORY.length; index += 1) {
    const now = index * HOUR;
    assert.equal(repertoryIndexAt(now), index);
    assert.equal(repertoryIndexAt(now + HOUR), (index + 1) % STUDIO_REPERTORY.length);
  }
});

test('the boundary timer is positive and lands on the next hour', () => {
  const now = Date.UTC(2026, 6, 13, 18, 41, 12, 250);
  const delay = millisecondsToNextHour(now);
  assert.ok(delay > 0 && delay <= HOUR);
  assert.equal((now + delay) % HOUR, 0);
});

test('invalid scheduling inputs fail closed', () => {
  assert.throws(() => repertoryIndexAt(Number.NaN), TypeError);
  assert.throws(() => repertoryIndexAt(Date.now(), 0), RangeError);
  assert.throws(() => productionAt(Date.now(), []), RangeError);
});
