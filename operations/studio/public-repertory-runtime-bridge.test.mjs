import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../../src/engine/publicRepertoryRuntime.js', import.meta.url), 'utf8');

test('bridge remains opt-in and preserves the current production surface', () => {
  assert.match(source, /querySelector\?\.\('\[data-repertory-stage\]'\)/);
  assert.match(source, /installed: false, reason: 'stage_absent'/);
  assert.doesNotMatch(source, /document\.body\.replaceChildren/);
  assert.doesNotMatch(source, /getElementById\('root'\)/);
});

test('bridge delegates deterministic selection to the retained runtime', () => {
  assert.match(source, /createPublicRepertoryRuntime/);
  assert.match(source, /await runtime\.present\(\)/);
  assert.match(source, /continuity: CONTINUITY/);
  assert.match(source, /rollback_selector/);
});

test('all catalog renderers are present and cannot request autoplay', () => {
  for (const renderer of ['coordinateBloom', 'paperWeather', 'signalGarden', 'nightIndex', 'hingeTheatre', 'softMachineRoom']) {
    assert.match(source, new RegExp(`${renderer}: createRenderer`));
  }
  assert.match(source, /autoplay: false/);
  assert.doesNotMatch(source, /\.play\(/);
  assert.doesNotMatch(source, /autoplay\s*=\s*true/);
});

test('rollback removes only the staged repertory mount', () => {
  assert.match(source, /root\.querySelector\(presentation\.runtime\.rollback_selector\)/);
  assert.match(source, /mount\.remove\(\)/);
  assert.doesNotMatch(source, /root\.replaceChildren\(\)/);
});
