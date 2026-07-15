import test from 'node:test';
import assert from 'node:assert/strict';
import { ROOM_SCORE_VERSION, scoreSequence, scoreVisit } from './room-score.mjs';

test('zero visit is a stable listening state', () => {
  assert.deepEqual(scoreVisit(0), {
    visit: 0,
    active: false,
    index: 0,
    mode: 'listening',
    line: 'The room is listening for a shape, not a name.',
    doorLabel: 'Enter without proof',
    countLabel: '00',
    field: { x: 0.5, y: 0.6, radius: 0.48, phase: 0 },
    audio: { frequencyStart: 73, frequencyEnd: 42, duration: 1.75, gainPeak: 0.028 }
  });
});

test('same visit always creates the same complete score', () => {
  assert.deepEqual(scoreVisit(7), scoreVisit(7));
  assert.equal(JSON.stringify(scoreVisit(7)), JSON.stringify(scoreVisit(7)));
});

test('the fourth threshold changes the door language', () => {
  assert.equal(scoreVisit(4).doorLabel, 'The room entered you');
  assert.equal(scoreVisit(8).doorLabel, 'The room entered you');
  assert.equal(scoreVisit(5).doorLabel, 'Enter again');
});

test('the narrative cycle repeats while spatial state continues evolving', () => {
  assert.equal(scoreVisit(1).line, scoreVisit(9).line);
  assert.notDeepEqual(scoreVisit(1).field, scoreVisit(9).field);
});

test('radius growth is bounded after twelve entries', () => {
  assert.equal(scoreVisit(12).field.radius, 0.624);
  assert.equal(scoreVisit(1000).field.radius, 0.624);
});

test('sequence includes the pre-entry state and requested visits', () => {
  const sequence = scoreSequence(3);
  assert.equal(sequence.length, 4);
  assert.deepEqual(sequence.map((score) => score.visit), [0, 1, 2, 3]);
});

test('invalid visit values fail closed', () => {
  for (const invalid of [-1, 1.2, Number.MAX_SAFE_INTEGER + 1, NaN, '2']) {
    assert.throws(() => scoreVisit(invalid), /non-negative safe integer/);
  }
});

test('score version is explicit', () => {
  assert.equal(ROOM_SCORE_VERSION, '1.0.0');
});
