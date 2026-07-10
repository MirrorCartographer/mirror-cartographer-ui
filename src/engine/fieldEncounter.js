const MOODS = {
  excite: { energy: 0.92, rhythm: 10, warmth: 0.78, tension: 0.62 },
  intrigue: { energy: 0.68, rhythm: 6, warmth: 0.58, tension: 0.86 },
  relax: { energy: 0.34, rhythm: 2, warmth: 0.72, tension: 0.18 },
  joy: { energy: 0.78, rhythm: 8, warmth: 0.9, tension: 0.34 },
};

const WEATHER_BIAS = {
  lightning: 'excite',
  wind: 'intrigue',
  aurora: 'intrigue',
  rain: 'relax',
  murmur: 'relax',
  dawn: 'joy',
  clear: 'joy',
  cloud: 'intrigue',
};

const SECTION_BIAS = {
  seed: 'intrigue',
  lift: 'joy',
  answer: 'relax',
  storm: 'excite',
  home: 'relax',
};

const clamp01 = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const finiteOr = (value, fallback = 0) => (Number.isFinite(value) ? value : fallback);
const rounded = (value) => Math.round(finiteOr(value, 0) * 1000) / 1000;

function normalizeFrame(frame = {}) {
  return {
    state: typeof frame.state === 'string' ? frame.state : 'cloud',
    section: typeof frame.section === 'string' ? frame.section : 'seed',
    beat: Math.max(0, Math.floor(finiteOr(frame.beat, 0))),
    phrase: Math.max(0, Math.floor(finiteOr(frame.phrase, 0))),
    phrasePhase: clamp01(frame.phrasePhase),
    pulse: clamp01(frame.pulse ?? frame.energy),
    density: clamp01(frame.density),
    rhythm: Math.max(0, Math.min(12, finiteOr(frame.rhythm, 0))),
  };
}

function inferExpectation({ frame, memory = {}, interaction = {} }) {
  const tapVelocity = clamp01(finiteOr(interaction.tapVelocity, 0));
  const dwell = clamp01(finiteOr(interaction.dwellMs, 0) / 12000);
  const repetition = clamp01(finiteOr(interaction.repetition, 0));
  const memoryTurn = clamp01(memory.turn);
  const memoryRise = clamp01(memory.rise);
  const weatherMood = WEATHER_BIAS[frame.state] || 'intrigue';
  const sectionMood = SECTION_BIAS[frame.section] || 'intrigue';

  return {
    excite: clamp01((weatherMood === 'excite' ? 0.38 : 0.08) + tapVelocity * 0.42 + frame.pulse * 0.2),
    intrigue: clamp01((weatherMood === 'intrigue' ? 0.3 : 0.12) + memoryTurn * 0.32 + repetition * 0.2 + (sectionMood === 'intrigue' ? 0.18 : 0)),
    relax: clamp01((weatherMood === 'relax' ? 0.34 : 0.08) + dwell * 0.36 + (1 - frame.density) * 0.22),
    joy: clamp01((weatherMood === 'joy' ? 0.28 : 0.1) + memoryRise * 0.24 + (sectionMood === 'joy' ? 0.2 : 0)),
  };
}

function normalizeExpectation(expectation, fallback) {
  if (!expectation || typeof expectation !== 'object') return fallback;
  return Object.fromEntries(
    Object.keys(MOODS).map((key) => [key, clamp01(expectation[key] ?? fallback[key])]),
  );
}

function makePossibleFutures(frame, expectation) {
  return Object.entries(MOODS).map(([mood, target]) => {
    const desiredEnergy = target.energy;
    const desiredRhythm = target.rhythm;
    const coherence = 1 - Math.abs((WEATHER_BIAS[frame.state] === mood ? 1 : 0.45) - expectation[mood]);
    const energyDelta = desiredEnergy - frame.pulse;
    const rhythmDelta = (desiredRhythm - frame.rhythm) / 12;
    const score = expectation[mood] * 0.52 + coherence * 0.22 + (1 - Math.abs(energyDelta)) * 0.16 + (1 - Math.abs(rhythmDelta)) * 0.1;

    return {
      mood,
      score: rounded(score),
      fieldDelta: {
        energy: rounded(energyDelta),
        rhythm: rounded(rhythmDelta),
        warmth: rounded(target.warmth - frame.density),
        tension: rounded(target.tension - frame.phrasePhase),
      },
    };
  }).sort((a, b) => b.score - a.score);
}

export function selectFieldEncounter(input = {}) {
  const frame = normalizeFrame(input.frame);
  const memory = input.memory && typeof input.memory === 'object' ? input.memory : {};
  const fallbackExpectation = inferExpectation({ frame, memory, interaction: input.interaction });
  const expectation = normalizeExpectation(input.expectation, fallbackExpectation);
  const possibleFutures = makePossibleFutures(frame, expectation);
  const selectedFuture = possibleFutures[0];

  return {
    exists: frame,
    expectation,
    possibleFutures,
    selectedFuture,
    fieldDelta: selectedFuture.fieldDelta,
    memoryDelta: {
      phrase: frame.phrase,
      section: frame.section,
      rememberedMood: selectedFuture.mood,
      salience: rounded(selectedFuture.score * (0.5 + frame.density * 0.5)),
    },
    invitation: {
      holdMs: Math.round(2600 + (1 - expectation.excite) * 2200),
      nextGesture: selectedFuture.mood === 'relax' ? 'hold' : selectedFuture.mood === 'excite' ? 'strike' : 'wander',
      visualPressure: rounded(frame.density + selectedFuture.fieldDelta.tension * 0.25),
      audioPressure: rounded(frame.pulse + selectedFuture.fieldDelta.energy * 0.35),
    },
  };
}
