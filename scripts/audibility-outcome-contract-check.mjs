import assert from 'node:assert/strict';
import {
  buildAudibilityEvidence,
  buildPulseFailureEvidence,
  classifyAudibilityDiagnostic,
  resetAudibilityAttempt,
} from '../src/engine/audibilityOutcomeRuntime.js';

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
    schemaVersion: '1.1.0',
    outcome: 'heard',
    diagnosis: 'audible-confirmed',
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

assert.equal(classifyAudibilityDiagnostic('not-heard', pulse, render), 'render-confirmed-not-heard');
assert.equal(
  classifyAudibilityDiagnostic('not-heard', pulse, { result: 'clock-progress-only' }),
  'clock-advanced-not-heard',
);
assert.equal(
  classifyAudibilityDiagnostic('not-heard', pulse, { result: 'clock-only' }),
  'not-heard-render-unconfirmed',
);
assert.equal(
  classifyAudibilityDiagnostic('not-heard', { played: false }, render),
  'pulse-not-scheduled',
);
assert.equal(
  classifyAudibilityDiagnostic('not-heard', pulse, null),
  'not-heard-render-unconfirmed',
);

const notHeard = buildAudibilityEvidence('not-heard', { played: false }, null, '2026-07-11T21:00:02.000Z');
assert.equal(notHeard.outcome, 'not-heard');
assert.equal(notHeard.diagnosis, 'pulse-not-scheduled');
assert.equal(notHeard.pulse.played, false);
assert.equal(notHeard.render.result, 'unobserved');

const failedPulse = buildPulseFailureEvidence(
  { played: false, reason: 'context-suspended', state: 'suspended' },
  { result: 'unobserved', state: 'suspended' },
  '2026-07-11T21:00:03.000Z',
);
assert.equal(failedPulse.outcome, 'not-heard');
assert.equal(failedPulse.diagnosis, 'pulse-not-scheduled');
assert.equal(failedPulse.pulse.reason, 'context-suspended');
assert.equal(failedPulse.pulse.state, 'suspended');
assert.throws(() => buildPulseFailureEvidence(pulse, render), /requires an unscheduled pulse/);
assert.throws(() => buildAudibilityEvidence('maybe', pulse, render), /Invalid audibility outcome/);
assert.throws(() => classifyAudibilityDiagnostic('maybe', pulse, render), /Invalid audibility outcome/);

const retryState = {
  __MC_AUDIO_PULSE__: pulse,
  __MC_AUDIO_EVIDENCE__: render,
  __MC_AUDIBILITY_EVIDENCE__: buildAudibilityEvidence('heard', pulse, render),
};
const pending = resetAudibilityAttempt(retryState, '2026-07-11T21:00:04.000Z');
assert.deepEqual(pending, {
  played: false,
  reason: 'pending',
  frequencyHz: null,
  durationSeconds: null,
  state: 'pending',
  startedAt: '2026-07-11T21:00:04.000Z',
});
assert.equal(retryState.__MC_AUDIO_PULSE__, pending);
assert.equal(retryState.__MC_AUDIO_EVIDENCE__, null);
assert.equal(retryState.__MC_AUDIBILITY_EVIDENCE__, null);
assert.equal(classifyAudibilityDiagnostic('not-heard', retryState.__MC_AUDIO_PULSE__, retryState.__MC_AUDIO_EVIDENCE__), 'pulse-not-scheduled');
assert.throws(() => resetAudibilityAttempt(null), /target must be an object/);

console.log('audibility outcome contract: ok');
