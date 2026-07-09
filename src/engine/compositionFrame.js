const FORM = ['seed', 'seed', 'lift', 'answer', 'storm', 'answer', 'lift', 'home'];
const SECTION_DENSITY = {
  seed: [0.42, 0.48, 0.58, 0.5],
  lift: [0.58, 0.7, 0.78, 0.86],
  answer: [0.64, 0.5, 0.68, 0.46],
  storm: [0.78, 0.92, 0.7, 1],
  home: [0.5, 0.38, 0.3, 0.22],
};
const WEATHER_DENSITY = {
  cloud: 0.94,
  rain: 0.86,
  lightning: 0.78,
  clear: 0.98,
  aurora: 1.04,
  dawn: 0.96,
  wind: 0.82,
  murmur: 0.9,
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

function compositionShape(projected, rhythm = 0) {
  const beat = Number.isFinite(projected?.beat) ? projected.beat : 0;
  const phraseIndex = Math.floor((beat % 128) / 16);
  const inPhrase = beat % 16;
  const section = FORM[phraseIndex % FORM.length];
  const densityArc = SECTION_DENSITY[section] || SECTION_DENSITY.seed;
  const densitySlot = Math.min(densityArc.length - 1, Math.floor(inPhrase / 4));
  const weatherDensity = WEATHER_DENSITY[projected?.state] ?? WEATHER_DENSITY.cloud;
  const density = clamp((densityArc[densitySlot] ?? 0.5) * weatherDensity + clamp(projected?.energy ?? 0.5, 0, 1) * 0.1, 0.18, 1);

  return {
    section,
    inPhrase,
    density,
    phrasePhase: inPhrase / 16,
    rhythm: Number.isFinite(rhythm) ? rhythm : 0,
  };
}

export function createCompositionFrame(clock, input = {}) {
  const projected = clock?.snapshot?.({
    now: input.now,
    state: input.state,
    pulse: input.pulse,
    rhythm: input.rhythm,
  });

  if (!projected) return null;

  const shape = compositionShape(projected, input.rhythm);

  return {
    state: projected.state,
    pulse: projected.energy,
    rhythm: shape.rhythm,
    beat: projected.beat,
    phase: projected.phase,
    phrase: projected.phrase,
    section: shape.section,
    inPhrase: shape.inPhrase,
    density: shape.density,
    phrasePhase: shape.phrasePhase,
  };
}

export function createTapCompositionFrame(clock, input = {}) {
  const projected = clock?.tap?.({
    now: input.now,
    state: input.state,
    pulse: input.pulse,
    rhythm: input.rhythm,
  });

  if (!projected) return null;

  const shape = compositionShape(projected, input.rhythm);

  return {
    state: projected.state,
    pulse: projected.energy,
    rhythm: shape.rhythm,
    beat: projected.beat,
    phase: projected.phase,
    phrase: projected.phrase,
    section: shape.section,
    inPhrase: shape.inPhrase,
    density: shape.density,
    phrasePhase: shape.phrasePhase,
  };
}
