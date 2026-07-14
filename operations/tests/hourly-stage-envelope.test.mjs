import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createHourlyStageEnvelope } from '../tools/hourly-stage-envelope.mjs';

const schedulePath = new URL('../repertory/hourly-productions.json', import.meta.url);

async function loadSchedule() {
  return JSON.parse(await readFile(schedulePath, 'utf8'));
}

test('stage envelope exposes previous, current, and next productions without mutating the repertory', async () => {
  const schedule = await loadSchedule();
  const before = JSON.stringify(schedule.productions);
  const envelope = createHourlyStageEnvelope({
    repertory: schedule.productions,
    instant: '2026-07-14T09:47:09.000Z',
    timeZone: schedule.time_zone
  });

  assert.equal(envelope.resolved_hour, 5);
  assert.equal(envelope.selector, 'hour-05');
  assert.equal(envelope.continuity_channel, schedule.continuity_channel);
  assert.equal(envelope.stage.previous.id, 'archive-before-dawn');
  assert.equal(envelope.stage.current.id, 'first-light-proof');
  assert.equal(envelope.stage.next.id, 'morning-body-map');
  assert.equal(JSON.stringify(schedule.productions), before);
  assert.ok(Object.isFrozen(envelope));
  assert.ok(Object.isFrozen(envelope.stage));
});

test('stage neighborhood wraps deterministically at midnight', async () => {
  const schedule = await loadSchedule();
  const envelope = createHourlyStageEnvelope({
    repertory: schedule.productions,
    instant: '2026-07-14T04:30:00.000Z',
    timeZone: schedule.time_zone
  });

  assert.equal(envelope.resolved_hour, 0);
  assert.equal(envelope.stage.previous.hour, 23);
  assert.equal(envelope.stage.current.hour, 0);
  assert.equal(envelope.stage.next.hour, 1);
});

test('repeated daylight-saving hour selects one production and preserves continuity', async () => {
  const schedule = await loadSchedule();
  const firstOccurrence = createHourlyStageEnvelope({
    repertory: schedule.productions,
    instant: '2026-11-01T05:30:00.000Z',
    timeZone: schedule.time_zone
  });
  const secondOccurrence = createHourlyStageEnvelope({
    repertory: schedule.productions,
    instant: '2026-11-01T06:30:00.000Z',
    timeZone: schedule.time_zone
  });

  assert.equal(firstOccurrence.resolved_hour, 1);
  assert.equal(secondOccurrence.resolved_hour, 1);
  assert.equal(firstOccurrence.stage.current.id, 'one-eye-constellation');
  assert.equal(secondOccurrence.stage.current.id, 'one-eye-constellation');
  assert.equal(firstOccurrence.continuity_channel, secondOccurrence.continuity_channel);
  assert.notEqual(firstOccurrence.instant, secondOccurrence.instant);
});
