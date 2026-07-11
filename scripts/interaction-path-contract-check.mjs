import fs from 'node:fs';
import assert from 'node:assert/strict';
import { derivePossibilityField } from '../src/engine/possibilityFieldRuntime.js';

const paths = {
  orbit: [
    { state: 'rain', count: 1, dwellMs: 8400, tapVelocity: 0.08, repetition: 0, exploration: 0.12 },
    { state: 'rain', count: 3, dwellMs: 6200, tapVelocity: 0.16, repetition: 0.08, exploration: 0.48 },
    { state: 'cloud', count: 5, dwellMs: 4700, tapVelocity: 0.22, repetition: 0.12, exploration: 0.82 },
  ],
  strike: [
    { state: 'lightning', count: 1, dwellMs: 900, tapVelocity: 0.94, repetition: 0, exploration: 0.08 },
    { state: 'lightning', count: 4, dwellMs: 700, tapVelocity: 0.9, repetition: 0.76, exploration: 0.18 },
    { state: 'cloud', count: 5, dwellMs: 4700, tapVelocity: 0.22, repetition: 0.12, exploration: 0.82 },
  ],
};

function replay(sequence) {
  let memory = {};
  return sequence.map(({ state, ...interaction }) => {
    const field = derivePossibilityField({ state, interaction, memory });
    memory = { turn: field.tension, rise: field.warmth };
    return field;
  });
}

const orbit = replay(paths.orbit);
const strike = replay(paths.strike);
const orbitFinal = orbit.at(-1);
const strikeFinal = strike.at(-1);

for (const field of [...orbit, ...strike]) {
  for (const key of ['pressure', 'warmth', 'tension']) {
    assert.ok(field[key] >= 0 && field[key] <= 1, `${key} must remain bounded`);
  }
}

assert.notDeepEqual(
  orbitFinal,
  strikeFinal,
  'different histories must change the future field even when the final interaction frame matches',
);

const runtime = fs.readFileSync(new URL('../src/engine/possibilityFieldRuntime.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../src/assets/possibility-field.css', import.meta.url), 'utf8');

assert.doesNotMatch(runtime, /innerText|textContent|insertAdjacentText|createTextNode/, 'interaction memory must remain nonverbal');
assert.doesNotMatch(runtime, /createSkyMusic|AudioContext|\.start\(|\.pulse\(/, 'visual interaction memory must not own audio');
assert.match(css, /pointer-events:\s*none/, 'possibility membrane must remain pointer transparent');
assert.match(css, /prefers-reduced-motion/, 'reduced-motion protection must remain present');

console.log(JSON.stringify({
  contract: 'interaction-path-memory',
  orbitFinal,
  strikeFinal,
  divergent: true,
}, null, 2));
