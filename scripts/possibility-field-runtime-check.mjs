import fs from 'node:fs';
import assert from 'node:assert/strict';
import { derivePossibilityField } from '../src/engine/possibilityFieldRuntime.js';

const calm = derivePossibilityField({
  state: 'rain',
  interaction: {
    count: 2,
    dwellMs: 9000,
    tapVelocity: 0.08,
    repetition: 0,
    exploration: 0.12,
  },
});

const charged = derivePossibilityField({
  state: 'lightning',
  interaction: {
    count: 8,
    dwellMs: 1800,
    tapVelocity: 0.94,
    repetition: 0.72,
    exploration: 0.68,
  },
});

for (const field of [calm, charged]) {
  assert.ok(field.pressure >= 0 && field.pressure <= 1, 'pressure must stay bounded');
  assert.ok(field.warmth >= 0 && field.warmth <= 1, 'warmth must stay bounded');
  assert.ok(field.tension >= 0 && field.tension <= 1, 'tension must stay bounded');
  assert.equal(typeof field.mood, 'string', 'selected mood must remain inspectable');
  assert.equal('audioPressure' in field, false, 'visual runtime must not expose audio coupling');
}

assert.notDeepEqual(calm, charged, 'different encounter states must produce different visual fields');

const main = fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../src/assets/possibility-field.css', import.meta.url), 'utf8');
const runtime = fs.readFileSync(new URL('../src/engine/possibilityFieldRuntime.js', import.meta.url), 'utf8');

assert.match(main, /installPossibilityFieldRuntime\(\)/, 'main must install the visual runtime');
assert.match(runtime, /createEncounterState/, 'runtime must observe cumulative interaction');
assert.match(runtime, /selectFieldEncounter/, 'runtime must use the existing future selector');
assert.match(runtime, /pointerdown/, 'runtime must respond to actual encounter gestures');
assert.doesNotMatch(runtime, /createSkyMusic|\.start\(|\.pulse\(/, 'runtime must not control audio');
assert.match(css, /--possibility-pressure/, 'field pressure must reach CSS');
assert.match(css, /--possibility-x/, 'gesture location must reach CSS');
assert.match(css, /prefers-reduced-motion/, 'reduced-motion protection must remain');
assert.match(css, /pointer-events:\s*none/, 'field must not intercept interaction');

console.log('possibility field runtime contract: ok');
