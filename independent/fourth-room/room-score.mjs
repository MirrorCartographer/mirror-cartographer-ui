const TEXT = Object.freeze([
  'A small light moves behind the wall, keeping pace with your breathing.',
  'Nothing opens. The room becomes deeper anyway.',
  'A chair remembers the weight of someone who has not arrived.',
  'The ceiling lowers by one thought, then changes its mind.',
  'You hear a door close in a building with no second floor.',
  'The room gives back the silence, but warmer.',
  'A line appears where the horizon would be if this were outside.',
  'For one second, every object agrees on where the center is.'
]);

const MODES = Object.freeze(['listening', 'tilting', 'remembering', 'returning']);
const BASE_FREQUENCIES = Object.freeze([73, 84, 95, 106, 117]);

function assertVisit(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError('visit must be a non-negative safe integer');
  }
}

function round(value, places = 6) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}

/**
 * Produce the complete deterministic score for one room-entry state.
 * No wall-clock, random source, network input, or persistent identity is used.
 */
export function scoreVisit(visit) {
  assertVisit(visit);
  const active = visit > 0;
  const index = active ? (visit - 1) % TEXT.length : 0;
  const mode = MODES[visit % MODES.length];
  const phase = visit * 0.55;
  const x = round(0.5 + Math.sin(phase + visit * 0.31) * 0.16);
  const y = round(0.48 + Math.cos(phase * 1.3 + visit * 0.21) * 0.12);
  const radius = round(0.48 + Math.min(visit, 12) * 0.012);
  const frequencyStart = BASE_FREQUENCIES[visit % BASE_FREQUENCIES.length];
  const frequencyEnd = 42;
  const duration = round(1.75 + (visit % 4) * 0.15, 2);
  const gainPeak = round(0.028 + (visit % 3) * 0.004, 3);

  return Object.freeze({
    visit,
    active,
    index,
    mode,
    line: active ? TEXT[index] : 'The room is listening for a shape, not a name.',
    doorLabel: !active ? 'Enter without proof' : visit % 4 === 0 ? 'The room entered you' : 'Enter again',
    countLabel: String(visit).padStart(2, '0'),
    field: Object.freeze({ x, y, radius, phase: round(phase) }),
    audio: Object.freeze({ frequencyStart, frequencyEnd, duration, gainPeak })
  });
}

export function scoreSequence(count) {
  assertVisit(count);
  return Object.freeze(Array.from({ length: count + 1 }, (_, visit) => scoreVisit(visit)));
}

export const ROOM_SCORE_VERSION = '1.0.0';
