import assert from 'node:assert/strict';
import { clearPerceptionObservations, getPerceptionSnapshot, publishPerceptionObservation, subscribePerceptionObservations } from '../src/engine/perceptionLedger.js';

clearPerceptionObservations();
let received = null;
const unsubscribe = subscribePerceptionObservations((event) => { received = event; });
const event = publishPerceptionObservation({
  kind: 'audio-envelope', source: 'microphone', permission: 'explicit-grant',
  value: 0.42, confidence: 0.9, ttlMs: 1500
});
assert.equal(received.id, event.id);
assert.equal(event.scope, 'local-only');
assert.equal(event.retention, 'ephemeral');
assert.equal(event.value, 0.42);
assert.equal(getPerceptionSnapshot().length, 1);
assert.throws(() => publishPerceptionObservation({ kind: 'raw-audio', value: 'secret' }), /Unsupported/);
assert.throws(() => publishPerceptionObservation({ kind: 'audio-envelope', value: { samples: [1, 2, 3] } }), /Unsupported/);
unsubscribe();
clearPerceptionObservations();
assert.equal(getPerceptionSnapshot().length, 0);
console.log('PASS: perception provenance, bounded values, local-only scope, and ephemeral retention.');
