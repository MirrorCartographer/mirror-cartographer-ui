export const MUSIC_COMPOSITION_SPEC = {
  form: ['seed', 'seed', 'lift', 'answer', 'storm', 'answer', 'lift', 'home'],
  motif: [0, 2, 3, 5, 3, 2, 6, 5, 3, 1, 2, 0, 5, 6, 3, 2],
  answer: [5, 3, 2, 0, 2, 3, 1, -1, 0, 2, 5, 3, 2, 0, -2, 0],
  bassWalk: [0, 0, 2, 4, 5, 5, 4, 2, 7, 7, 6, 5, 3, 2, 1, 0],
  weatherMeters: {
    cloud: 4,
    rain: 6,
    lightning: 5,
    clear: 4,
    aurora: 7,
    dawn: 4,
    wind: 3,
    murmur: 6,
  },
  qualityGate: {
    scheduler: 'cap catch-up scheduling after mobile tab sleep so the engine never floods Web Audio with late events',
    density: 'make seed/home sections sparse, lift sections brighter, and storm sections narrower instead of stacking all layers',
    mix: 'lower rain noise, sparkle, and storm accent gain before the compressor so the limiter polishes rather than rescues overload',
    repetition: 'reserve upper sparkle for phrase endings only; avoid triggering it every small loop',
    mobile: 'preserve tap-to-start, no autoplay, no visible explanatory text, and no sampled assets',
  },
  nextImplementationTarget: 'apply sectionProfile() in skyMusic.js: per-section chord voice count, gain scaling, rain cadence thinning, sparkle gating, and MAX_EVENTS_PER_TICK scheduler catch-up protection',
};
