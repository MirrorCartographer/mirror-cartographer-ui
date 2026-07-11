import assert from 'node:assert/strict';
import {
  buildAudibilityEvidence,
  buildPulseFailureEvidence,
  classifyAudibilityDiagnostic,
  resetAudibilityAttempt,
} from '../src/engine/audibilityOutcomeRuntime.js';

const attemptId = 'mc-audio-attempt-001';
const pulse = {
  attemptId,
  played: true,
  reason: null,
  frequencyHz: 523.25,
  durationSeconds: 0.22,
  state: 'running',
  startedAt: '2026-07-11T21:00:00.000Z',
};
const render = {
  attemptId,
  result: 'render-confirmed',
  state: 'running',
  outputPosition: 2.4,
  currentTime: 2.5,
  sampledAt: '2026-07-11T21:00:00.420Z',
};

assert.deepEqual(
  buildAudibilityEvidence('heard', pulse, render, '2026-07-11T21:00:01.000Z'),
  {
    schemaVersion: '1.2.0',
    attemptId,
    attemptMatched: true,
    outcome: 'heard',
    diagnosis: 'audible-confirmed',
    recordedAt: '2026-07-11T21:00:01.000Z',
    pulse: {
      attemptId,
      played: true,
      reason: null,
      frequencyHz: 523.25,
      durationSeconds: 0.22,
      state: 'running',
      startedAt: '2026-07-11T21:00:00.000Z',
    },
    render: {
      attemptId,
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

const mismatched = buildAudibilityEvidence(
  'heard',
  pulse,
  { ...render, attemptId: 'mc-audio-attempt-older' },
  '2026-07-11T21:00:01.500Z',
);
assert.equal(mismatched.attemptMatched, false);
assert.equal(mismatched.diagnosis, 'attempt-evidence-mismatch');

const missingRenderIdentity = buildAudibilityEvidence(
  'not-heard',
  pulse,
  { ...render, attemptId: null },
  '2026-07-11T21:00:01.750Z',
);
assert.equal(missingRenderIdentity.attemptMatched, false);
assert.equal(missingRenderIdentity.diagnosis, 'attempt-evidence-mismatch');

const failedPulse = buildPulseFailureEvidence(
  { attemptId, played: false, reason: 'context-suspended', state: 'suspended' },
  null,
  '2026-07-11T21:00:03.000Z',
);
assert.equal(failedPulse.attemptMatched, true);
assert.equal(failedPulse.outcome, 'not-heard');
assert.equal(failedPulse.diagnosis, 'pulse-not-scheduled');
assert.equal(failedPulse.pulse.reason, 'context-suspended');
assert.throws(() => buildPulseFailureEvidence(pulse, render), /requires an unscheduled pulse/);
assert.throws(() => buildAudibilityEvidence('maybe', pulse, render), /Invalid audibility outcome/);
assert.throws(() => classifyAudibilityDiagnostic('maybe', pulse, render), /Invalid audibility outcome/);

const retryState = {
  __MC_AUDIO_PULSE__: pulse,
  __MC_AUDIO_EVIDENCE__: render,
  __MC_AUDIBILITY_EVIDENCE__: buildAudibilityEvidence('heard', pulse, render),
};
const pending = resetAudibilityAttempt(
  retryState,
  '2026-07-11T21:00:04.000Z',
  'mc-audio-attempt-002',
);
assert.deepEqual(pending, {
  attemptId: 'mc-audio-attempt-002',
  played: false,
  reason: 'pending',
  frequencyHz: null,
  durationSeconds: null,
  state: 'pending',
  startedAt: '2026-07-11T21:00:04.000Z',
});
assert.equal(retryState.__MC_AUDIO_ATTEMPT_ID__, 'mc-audio-attempt-002');
assert.equal(retryState.__MC_AUDIO_PULSE__, pending);
assert.equal(retryState.__MC_AUDIO_EVIDENCE__, null);
assert.equal(retryState.__MC_AUDIBILITY_EVIDENCE__, null);
assert.throws(() => resetAudibilityAttempt(null), /target must be an object/);
assert.throws(
  () => resetAudibilityAttempt({}, '2026-07-11T21:00:04.000Z', ''),
  /attempt id must be a non-empty string/,
);

console.log('audibility outcome contract: ok');
