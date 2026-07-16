import assert from 'node:assert/strict';
import { sanitizeSpatialDelta } from './spatialFieldEvidence.js';

const moved = sanitizeSpatialDelta('body_moved', { x:.91, y:.12, distance:.77, input:'keyboard', rawText:'secret', identity:'person' });
assert.equal(moved.schema, 'fia.interaction.delta/1');
assert.equal(moved.pan_band, 'high');
assert.equal(moved.height_band, 'low');
assert.equal(moved.distance_band, 'high');
assert.equal(moved.input, 'keyboard');
assert.equal('rawText' in moved, false);
assert.equal('identity' in moved, false);
assert.equal(sanitizeSpatialDelta('keystroke', { key:'a' }), null);
assert.equal(sanitizeSpatialDelta('field_played', { count:3 }).body_count_band, '2-3');
assert.equal(sanitizeSpatialDelta('field_stopped', { durationMs:65000 }).duration_band, '30-120s');
console.log('spatial evidence: 10 assertions passed');
