import fs from 'node:fs';
import { selectFieldEncounter } from '../src/engine/fieldEncounter.js';

const source = fs.readFileSync('src/engine/fieldEncounter.js', 'utf8');
const failures = [];
const check = (name, ok) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) failures.push(name);
};

const frame = {
  state: 'lightning',
  section: 'storm',
  beat: 33,
  phrase: 2,
  phrasePhase: 0.42,
  pulse: 0.71,
  density: 0.86,
  rhythm: 7,
};

const encounter = selectFieldEncounter({
  frame,
  memory: { rise: 0.73, turn: 0.64, density: 0.58 },
  interaction: { tapVelocity: 0.9, dwellMs: 1100, repetition: 0.4 },
});

check('exports pure selector', source.includes('export function selectFieldEncounter'));
check('does not touch browser globals', !/window\.|document\.|AudioContext|requestAnimationFrame/.test(source));
check('returns what exists', encounter.exists?.state === 'lightning' && encounter.exists?.section === 'storm');
check('returns possible futures', Array.isArray(encounter.possibleFutures) && encounter.possibleFutures.length === 4);
check('selects one actual future', typeof encounter.selectedFuture?.mood === 'string' && Number.isFinite(encounter.selectedFuture?.score));
check('returns field delta', Number.isFinite(encounter.fieldDelta?.energy) && Number.isFinite(encounter.fieldDelta?.rhythm));
check('returns memory delta', encounter.memoryDelta?.phrase === 2 && Number.isFinite(encounter.memoryDelta?.salience));
check('returns internal invitation', typeof encounter.invitation?.nextGesture === 'string' && Number.isFinite(encounter.invitation?.audioPressure));
check('keeps inferred values bounded', Object.values(encounter.expectation).every((value) => value >= 0 && value <= 1));
check('keeps deterministic ordering', encounter.possibleFutures.every((future, index, list) => index === 0 || list[index - 1].score >= future.score));

if (failures.length) {
  console.error(`\nField encounter contract failed: ${failures.length}`);
  process.exit(1);
}

console.log('\nField encounter contract passed');
