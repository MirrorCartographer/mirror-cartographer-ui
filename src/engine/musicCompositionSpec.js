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
  nextImplementationTarget: 'route current skyMusic chord scheduling through nearest-voice chord motion and weather-specific meter accents',
};
