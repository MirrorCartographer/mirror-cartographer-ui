import assert from 'node:assert/strict';
import { buildAudioDeviceEvidence } from '../src/engine/audioDeviceEvidenceRuntime.js';

const matches = new Map([
  ['(pointer: coarse)', true],
  ['(hover: hover)', false],
  ['(display-mode: standalone)', true],
  ['(prefers-reduced-motion: reduce)', false],
]);

const evidence = buildAudioDeviceEvidence({
  innerWidth: 390,
  innerHeight: 844,
  devicePixelRatio: 3,
  maxTouchPoints: 5,
  standalone: false,
  matchMediaImpl: (query) => ({ matches: matches.get(query) || false }),
  capturedAt: '2026-07-12T04:35:00.000Z',
});

assert.equal(evidence.viewport.widthBucket, 'lte-390');
assert.equal(evidence.viewport.orientation, 'portrait');
assert.equal(evidence.viewport.pixelRatioBucket, 'gte-3');
assert.equal(evidence.input.touchCapable, true);
assert.equal(evidence.input.coarsePointer, true);
assert.equal(evidence.input.hoverAvailable, false);
assert.equal(evidence.display.standalone, true);
assert.equal(evidence.privacy.rawUserAgentCollected, false);
assert.equal(evidence.privacy.exactViewportCollected, false);
assert.equal(evidence.privacy.persistentIdentifierCollected, false);
assert.equal(JSON.stringify(evidence).includes('userAgent'), false);

const unknown = buildAudioDeviceEvidence({ innerWidth: 0, innerHeight: 0 });
assert.equal(unknown.viewport.widthBucket, 'unknown');
assert.equal(unknown.viewport.orientation, 'unknown');

console.log('audio device evidence contract: ok');
