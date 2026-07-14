import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { selectHourlyProduction, validateRepertory } from '../tools/hourly-repertory-selector.mjs';

const scheduleUrl = new URL('../repertory/hourly-productions.json', import.meta.url);
const schedule = JSON.parse(await readFile(scheduleUrl, 'utf8'));

test('the production schedule satisfies the 24-hour repertory contract', () => {
  const result = validateRepertory(schedule.productions);
  assert.deepEqual(result, {
    slot_count: 24,
    continuity_channel: 'mirror-cartographer-continuity-v1'
  });
});

test('every hour deterministically resolves to its matching production', () => {
  for (let hour = 0; hour < 24; hour += 1) {
    const instant = new Date(Date.UTC(2026, 0, 15, hour, 30));
    const selected = selectHourlyProduction({
      repertory: schedule.productions,
      instant,
      timeZone: 'UTC'
    });
    assert.equal(selected.resolved_hour, hour);
    assert.equal(selected.production.hour, hour);
    assert.equal(selected.selector, `hour-${String(hour).padStart(2, '0')}`);
  }
});

test('all productions preserve safety and reversibility declarations', () => {
  for (const production of schedule.productions) {
    assert.equal(production.autoplay, false);
    assert.equal(production.payment_or_conversion_logic, false);
    assert.equal(production.mobile_safe, true);
    assert.equal(production.accessible, true);
    assert.equal(production.reversible, true);
    assert.equal(production.continuity_channel, schedule.continuity_channel);
    assert.ok(production.provenance.observed.length > 0);
    assert.ok(production.provenance.inferred.length > 0);
    assert.ok(production.provenance.experiment.length > 0);
    assert.ok(production.provenance.current_decision.length > 0);
  }
});

test('midnight production is the current stage contract', () => {
  const selected = selectHourlyProduction({
    repertory: schedule.productions,
    instant: '2026-07-14T04:44:26.000Z',
    timeZone: schedule.time_zone
  });
  assert.equal(selected.resolved_hour, 0);
  assert.equal(selected.production.id, 'midnight-coordinate-room');
});
