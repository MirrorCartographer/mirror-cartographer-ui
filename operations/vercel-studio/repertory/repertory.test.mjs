import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { selectProduction, validateRepertory } from './repertory.mjs';

const schedule = JSON.parse(await readFile(new URL('./schedule.json', import.meta.url), 'utf8'));

test('validates a complete deterministic 24-hour repertory', () => {
  assert.equal(validateRepertory(schedule), true);
});

test('selects the production assigned to the local hour', () => {
  assert.equal(selectProduction(schedule, 18).id, 'hour-18');
});

test('normalizes hours without introducing randomness', () => {
  assert.equal(selectProduction(schedule, 24).id, 'hour-00');
  assert.equal(selectProduction(schedule, -1).id, 'hour-23');
});

test('rejects duplicate hours', () => {
  const invalid = structuredClone(schedule);
  invalid.productions[1].hour = 0;
  assert.throws(() => validateRepertory(invalid), /duplicate production hour/);
});

test('rejects autoplay productions', () => {
  const invalid = structuredClone(schedule);
  invalid.productions[0].autoplay = true;
  assert.throws(() => validateRepertory(invalid), /must disable autoplay/);
});

test('rejects continuity-state forks', () => {
  const invalid = structuredClone(schedule);
  invalid.productions[0].continuity_channel = 'private-fork';
  assert.throws(() => validateRepertory(invalid), /must preserve shared-runtime-state/);
});
