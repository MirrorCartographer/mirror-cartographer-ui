import assert from 'node:assert/strict';
import { classifyAudioObservation, playDiagnosticPulse } from '../src/engine/audioObservabilityRuntime.js';

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

const calls = [];
class FakeAudioContext {
  constructor() {
    this.state = 'suspended';
    this.currentTime = 10;
    this.destination = { kind: 'destination' };
  }

  async resume() {
    calls.push(['resume']);
    this.state = 'running';
  }

  createOscillator() {
    return {
      type: '',
      frequency: { setValueAtTime: (...args) => calls.push(['frequency', ...args]) },
      connect: (target) => calls.push(['oscillator-connect', target]),
      start: (time) => calls.push(['start', time]),
      stop: (time) => calls.push(['stop', time]),
    };
  }

  createGain() {
    return {
      gain: {
        setValueAtTime: (...args) => calls.push(['gain-set', ...args]),
        exponentialRampToValueAtTime: (...args) => calls.push(['gain-ramp', ...args]),
      },
      connect: (target) => calls.push(['gain-connect', target]),
    };
  }
}

const pulse = await playDiagnosticPulse(FakeAudioContext);
assert.equal(pulse.played, true);
assert.equal(pulse.state, 'running');
assert.equal(pulse.frequencyHz, 523.25);
assert.equal(pulse.durationSeconds, 0.22);
assert.equal(pulse.gain, 0.08);
assert.deepEqual(calls[0], ['resume']);
assert.deepEqual(calls.find(([name]) => name === 'frequency'), ['frequency', 523.25, 10]);
assert.deepEqual(calls.find(([name]) => name === 'start'), ['start', 10]);
assert.deepEqual(calls.find(([name]) => name === 'stop'), ['stop', 10.22]);
assert.equal((await playDiagnosticPulse(null)).reason, 'unsupported');

console.log('audio observability contract: ok');
