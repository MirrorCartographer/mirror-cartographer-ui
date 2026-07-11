import assert from 'node:assert/strict';
import { classifyAudioObservation } from '../src/engine/audioObservabilityRuntime.js';

assert.equal(
  classifyAudioObservation(
    { supported: true, state: 'running', currentTime: 1, outputPosition: 0.5 },
    { supported: true, state: 'running', currentTime: 1.4, outputPosition: 0.9 },
  ),
  'render-confirmed',
);

assert.equal(
  classifyAudioObservation(
    { supported: true, state: 'running', currentTime: 1, outputPosition: null },
    { supported: true, state: 'running', currentTime: 1.4, outputPosition: null },
  ),
  'clock-progress-only',
);

assert.equal(
  classifyAudioObservation(
    { supported: true, state: 'running', currentTime: 1, outputPosition: 0 },
    { supported: true, state: 'running', currentTime: 1, outputPosition: 0 },
  ),
  'running-without-observed-progress',
);

assert.equal(
  classifyAudioObservation(
    { supported: true, state: 'suspended', currentTime: 0, outputPosition: 0 },
    { supported: true, state: 'suspended', currentTime: 0, outputPosition: 0 },
  ),
  'activation-blocked-or-suspended',
);

assert.equal(classifyAudioObservation({}, { supported: false }), 'unsupported');
assert.equal(classifyAudioObservation({}, { supported: true, state: 'closed' }), 'closed');

console.log('audio observability contract: ok');
