import assert from 'node:assert/strict';
import test from 'node:test';
import schedule from './schedule.json' with { type: 'json' };
import { selectProductionForDate, selectProductionForHour } from './select-production.mjs';

test('selects exactly one production for every hour', () => {
  const selected = Array.from({ length: 24 }, (_, hour) => selectProductionForHour(schedule, hour));
  assert.deepEqual(selected.map(({ id }) => id), Array.from({ length: 24 }, (_, hour) => `hour-${String(hour).padStart(2, '0')}`));
  assert.equal(new Set(selected.map(({ id }) => id)).size, 24);
});

test('uses the configured timezone rather than host-local time', () => {
  const instant = new Date('2026-07-14T00:09:30.000Z');
  assert.equal(selectProductionForDate(schedule, instant).id, 'hour-20');
  assert.equal(selectProductionForDate(schedule, instant, 'UTC').id, 'hour-00');
});

test('is deterministic for repeated selection', () => {
  const instant = new Date('2026-07-14T00:09:30.000Z');
  const first = selectProductionForDate(schedule, instant);
  const second = selectProductionForDate(schedule, instant);
  assert.deepEqual(first, second);
  assert.equal(first.title, 'House Lights');
});

test('fails closed on invalid hours and timezones', () => {
  assert.throws(() => selectProductionForHour(schedule, -1), /hour must be an integer/);
  assert.throws(() => selectProductionForHour(schedule, 24), /hour must be an integer/);
  assert.throws(() => selectProductionForDate(schedule, new Date(), 'Not\/A_Zone'), /invalid timeZone/);
});

test('rejects schedule drift that could fork continuity or enable autoplay', () => {
  const autoplaySchedule = structuredClone(schedule);
  autoplaySchedule.productions[20].autoplay = true;
  assert.throws(() => selectProductionForHour(autoplaySchedule, 20), /autoplay must remain disabled/);

  const forkedSchedule = structuredClone(schedule);
  forkedSchedule.productions[20].continuity_channel = 'forked-state';
  assert.throws(() => selectProductionForHour(forkedSchedule, 20), /continuity channel mismatch/);

  const incompleteSchedule = structuredClone(schedule);
  incompleteSchedule.productions.pop();
  assert.throws(() => selectProductionForHour(incompleteSchedule, 20), /exactly 24 productions/);
});

test('rejects loss of required accessibility guarantees', () => {
  for (const requirement of ['keyboard-complete', 'screen-reader-labelled', 'reduced-motion-safe']) {
    const driftedSchedule = structuredClone(schedule);
    driftedSchedule.productions[20].accessibility = driftedSchedule.productions[20].accessibility.filter(
      (value) => value !== requirement,
    );
    assert.throws(
      () => selectProductionForHour(driftedSchedule, 20),
      new RegExp(`accessibility requirement ${requirement} missing`),
    );
  }

  const missingAccessibilitySchedule = structuredClone(schedule);
  delete missingAccessibilitySchedule.productions[20].accessibility;
  assert.throws(
    () => selectProductionForHour(missingAccessibilitySchedule, 20),
    /accessibility guarantees missing/,
  );
});

test('rejects a fallback that does not resolve to a scheduled production', () => {
  const unresolvedFallbackSchedule = structuredClone(schedule);
  unresolvedFallbackSchedule.selection.fallback = 'hour-99';
  assert.throws(
    () => selectProductionForHour(unresolvedFallbackSchedule, 20),
    /schedule fallback does not resolve/,
  );
});

test('freezes nested accessibility guarantees in the selected production', () => {
  const selected = selectProductionForHour(schedule, 20);
  assert.equal(Object.isFrozen(selected), true);
  assert.equal(Object.isFrozen(selected.accessibility), true);
  assert.throws(() => selected.accessibility.push('pointer-only'));
});
