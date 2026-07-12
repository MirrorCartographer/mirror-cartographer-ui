import assert from 'node:assert/strict';
import { classifyAudioAudibilityEvidence } from './audio-audibility-evidence.mjs';

const base = { audioContextSupported: true, userActivationObserved: true, resumeFulfilled: true, contextStateAfter: 'running', sourceStarted: true, destinationConnected: true };
const cases = [
  [{ ...base, audioContextSupported: false }, 'unsupported', false],
  [{ ...base, userActivationObserved: false }, 'blocked', false],
  [{ ...base, sourceStarted: false }, 'runtime_only', false],
  [{ ...base, signalObserved: true }, 'signal_observed', false],
  [{ ...base, signalObserved: true, humanReportedAudible: false }, 'contradicted', false],
  [{ ...base, signalObserved: true, humanReportedAudible: true }, 'human_confirmed', true]
];
for (const [input, state, claim] of cases) {
  const actual = classifyAudioAudibilityEvidence(input);
  assert.equal(actual.state, state);
  assert.equal(actual.supportsAudibilityClaim, claim);
}
console.log(JSON.stringify({ tests: cases.length, passed: cases.length, failed: 0 }));
