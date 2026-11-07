import assert from 'node:assert/strict';
import { deriveResidentResponse } from '../src/engine/residentResponsePolicy.js';

const event = (kind, value) => ({ kind, value, scope: 'local-only', retention: 'ephemeral' });
assert.equal(deriveResidentResponse(event('pointer-position', { x: 0.5, y: 0.8 })).cue, 'approach-tazar');
assert.equal(deriveResidentResponse(event('pointer-position', { x: 0.8, y: 0.8 })).cue, 'approach-jello');
assert.equal(deriveResidentResponse(event('audio-envelope', 0.2)).cue, 'sound');
assert.equal(deriveResidentResponse(event('audio-envelope', 0.01)).cue, 'quiet');
assert.equal(deriveResidentResponse(event('page-visibility', false)).cue, 'away');
assert.equal(deriveResidentResponse(event('pointer-leave', true)).cue, 'away');
assert.equal(deriveResidentResponse(event('pointer-stillness', true)).cue, 'still');
assert.equal(deriveResidentResponse(event('window-focus', true)).cue, 'return');
assert.equal(deriveResidentResponse(event('character-focus', 'tazar')).resident, 'tazar');
assert.equal(deriveResidentResponse(event('character-focus', 'jello')).resident, 'jello');

assert.equal(deriveResidentResponse(event('submitted-language', 'jello')).cue, 'conversation');
assert.equal(deriveResidentResponse(event('resident-choice', 'asked-jello')).cue, 'choice');
assert.equal(deriveResidentResponse({ ...event('pointer-position', { x: 0.5, y: 0.8 }), scope: 'public' }), null);
assert.equal(deriveResidentResponse({ ...event('audio-envelope', 0.2), retention: 'durable' }), null);
console.log('PASS: resident response policy maps only bounded observable signals to scene cues.');
