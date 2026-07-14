import test from 'node:test';
import assert from 'node:assert/strict';
import { selectHourlyProduction, validateRepertory } from './hourly-repertory-selector.mjs';

function makeRepertory() {
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    id: `production-${String(hour).padStart(2, '0')}`,
    continuity_channel: 'shared-runtime-state',
    autoplay: false,
    payment_or_conversion_logic: false,
    mobile_safe: true,
    accessible: true,
    reversible: true
  }));
}

test('validates one complete deterministic 24-hour repertory', () => {
  assert.deepEqual(validateRepertory(makeRepertory()), {
    slot_count: 24,
    continuity_channel: 'shared-runtime-state'
  });
});

test('selects the same production for the same instant and timezone', () => {
  const input = { repertory: makeRepertory(), instant: '2026-07-14T03:35:12.000Z', timeZone: 'America/New_York' };
  assert.deepEqual(selectHourlyProduction(input), selectHourlyProduction(input));
  assert.equal(selectHourlyProduction(input).selector, 'hour-23');
  assert.equal(selectHourlyProduction(input).production.id, 'production-23');
});

test('makes timezone choice explicit rather than host-dependent', () => {
  const repertory = makeRepertory();
  assert.equal(selectHourlyProduction({ repertory, instant: '2026-07-14T03:35:12.000Z', timeZone: 'UTC' }).selector, 'hour-03');
  assert.equal(selectHourlyProduction({ repertory, instant: '2026-07-14T03:35:12.000Z', timeZone: 'America/New_York' }).selector, 'hour-23');
});

test('rejects incomplete, duplicate, or unsafe repertories', () => {
  assert.throws(() => validateRepertory(makeRepertory().slice(0, 23)), /exactly 24/);

  const duplicate = makeRepertory();
  duplicate[23].hour = 22;
  assert.throws(() => validateRepertory(duplicate), /unique integers/);

  const autoplay = makeRepertory();
  autoplay[4].autoplay = true;
  assert.throws(() => validateRepertory(autoplay), /disable autoplay/);

  const discontinuous = makeRepertory();
  discontinuous[5].continuity_channel = 'isolated-state';
  assert.throws(() => validateRepertory(discontinuous), /one continuity channel/);
});

test('rejects invalid instants and unavailable timezone identifiers', () => {
  const repertory = makeRepertory();
  assert.throws(() => selectHourlyProduction({ repertory, instant: 'not-a-date' }), /valid date/);
  assert.throws(() => selectHourlyProduction({ repertory, instant: '2026-07-14T03:35:12.000Z', timeZone: 'Not/AZone' }), RangeError);
});
