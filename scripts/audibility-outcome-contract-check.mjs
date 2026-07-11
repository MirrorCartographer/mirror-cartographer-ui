import assert from 'node:assert/strict';
import { buildAudibilityEvidence } from '../src/engine/audibilityOutcomeRuntime.js';

const pulse = {
  played: true,
  reason: null,
  frequencyHz: 523.25,
  durationSeconds: 0.22,
  state: 'running',
  startedAt: '2026-07-11T21:00:00.000Z',
};
const render = {
  result: 'render-confirmed',
  state: 'running',
  outputPosition: 2.4,
  currentTime: 2.5,
  sampledAt: '2026-07-11T21:00:00.420Z',
};

assert.deepEqual(
  buildAudibilityEvidence('heard', pulse, render, '2026-07-11T21:00:01.000Z'),
  {
    schemaVersion: '1.0.0',
    outcome: 'heard',
    recordedAt: '2026-07-11T21:00:01.000Z',
    pulse: {
      played: true,
      reason: null,
      frequencyHz: 523.25,
      durationSeconds: 0.22,
      state: 'running',
      startedAt: '2026-07-11T21:00:00.000Z',
    },
    render: {
      result: 'render-confirmed',
      state: 'running',
      outputPosition: 2.4,
      currentTime: 2.5,
      sampledAt: '2026-07-11T21:00:00.420Z',
    },
  },
);

const notHeard = buildAudibilityEvidence('not-heard', { played: false }, null, '2026-07-11T21:00:02.000Z');
assert.equal(notHeard.outcome, 'not-heard');
assert.equal(notHeard.pulse.played, false);
assert.equal(notHeard.render.result, 'unobserved');
assert.throws(() => buildAudibilityEvidence('maybe', pulse, render), /Invalid audibility outcome/);

console.log('audibility outcome contract: ok');
