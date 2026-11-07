import assert from 'node:assert/strict';
import { deriveResidentResponse } from '../src/engine/residentResponsePolicy.js';

const event = (kind, value) => ({ kind, value, scope: 'local-only', retention: 'ephemeral' });
assert.equal(deriveResidentResponse(event('pointer-position', { x: 0.5, y: 0.8 })).cue, 'approach-tazar');
assert.equal(deriveResidentResponse(event('pointer-position', { x: 0.8, y: 0.8 })).cue, 'approach-jello');
assert.equal(deriveResidentResponse(event('audio-envelope', 0.2)).cue, 'sound');
assert.equal(deriveResidentResponse(event('audio-envelope', 0.01)).cue, 'quiet');
assert.equal(deriveResidentResponse(event('page-visibility', false)).cue, 'away');
assert.equal(deriveResidentResponse({ ...event('pointer-position', { x: 0.5, y: 0.8 }), scope: 'public' }), null);
assert.equal(deriveResidentResponse({ ...event('audio-envelope', 0.2), retention: 'durable' }), null);
console.log('PASS: resident response policy maps only bounded observable signals to scene cues.');
