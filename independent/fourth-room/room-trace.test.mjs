import test from 'node:test';
import assert from 'node:assert/strict';
import { ROOM_TRACE_VERSION, traceForVisit } from './room-trace.mjs';

test('empty room has no trace', () => {
  assert.deepEqual(traceForVisit(0), {
    visit: 0,
    cycle: 0,
    step: 0,
    closed: false,
    points: [],
    description: 'No trace has been drawn.'
  });
});

test('trace grows deterministically by one segment per entry', () => {
  assert.equal(traceForVisit(1).points.length, 2);
  assert.equal(traceForVisit(4).points.length, 5);
  assert.deepEqual(traceForVisit(4), traceForVisit(4));
});

test('eighth entry closes the trace and starts the next cycle afterward', () => {
  const eighth = traceForVisit(8);
  assert.equal(eighth.closed, true);
  assert.equal(eighth.cycle, 1);
  assert.equal(eighth.points.length, 8);
  assert.equal(eighth.description, 'Trace 1 is complete.');

  const ninth = traceForVisit(9);
  assert.equal(ninth.closed, false);
  assert.equal(ninth.cycle, 1);
  assert.equal(ninth.points.length, 2);
  assert.equal(ninth.description, 'Trace 2 contains 1 of 7 segments.');
});

test('invalid visits fail closed', () => {
  for (const invalid of [-1, 2.5, NaN, '3']) {
    assert.throws(() => traceForVisit(invalid), /non-negative safe integer/);
  }
});

test('trace version is explicit', () => {
  assert.equal(ROOM_TRACE_VERSION, '1.0.0');
});
