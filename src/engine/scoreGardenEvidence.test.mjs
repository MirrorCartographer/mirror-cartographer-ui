import assert from 'node:assert/strict';
import { bandCount, bandDuration, sanitizeDelta } from './scoreGardenEvidence.js';

assert.equal(bandCount(0), '0');
assert.equal(bandCount(3), '1-3');
assert.equal(bandCount(6), '4-7');
assert.equal(bandCount(12), '8+');
assert.equal(bandDuration(14000), 'under-15s');
assert.equal(bandDuration(70000), '1-4m');

const valid = sanitizeDelta({
  type: 'seed_planted',
  seed_family: 'moss',
  note_count_band: '1-3',
  raw_text: 'do not keep me',
  identity: 'private'
});

assert.equal(valid.schema, 'fia.interaction.delta/1');
assert.equal(valid.feature, 'generative-score-garden');
assert.equal(valid.seed_family, 'moss');
assert.equal('raw_text' in valid, false);
assert.equal('identity' in valid, false);
assert.equal(sanitizeDelta({ type: 'keystroke', key: 'x' }), null);
assert.equal(sanitizeDelta({ type: 'microphone_sample', audio: '...' }), null);

console.log('score garden evidence: 13 assertions passed');
