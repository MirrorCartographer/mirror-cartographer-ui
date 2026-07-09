const WEATHER_TEMPO = {
  cloud: 0.92,
  rain: 0.78,
  lightning: 1.18,
  clear: 0.86,
  aurora: 0.68,
  dawn: 0.74,
  wind: 1.04,
  murmur: 0.82,
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

export function createCompositionClock() {
  const origin = Date.now();
  let tapCount = 0;
  let lastTap = 0;
  let phrase = 0;
  let energy = 0.5;

  function snapshot(input = {}) {
    const now = Number.isFinite(input.now) ? input.now : Date.now();
    const state = input.state || 'cloud';
    const pulse = clamp(input.pulse ?? energy, 0, 1);
    const rhythm = clamp(input.rhythm ?? 0, 0, 12);
    const weatherTempo = WEATHER_TEMPO[state] ?? WEATHER_TEMPO.cloud;
    const elapsed = Math.max(0, (now - origin) / 1000);
    const beatSeconds = clamp(0.72 / weatherTempo - rhythm * 0.018, 0.42, 1.12);
    const beat = Math.floor(elapsed / beatSeconds);
    const phase = (elapsed % beatSeconds) / beatSeconds;
    const bar = Math.floor(beat / 4);
    const phraseIndex = Math.floor(beat / 16);

    return {
      now,
      state,
      beat,
      bar,
      phrase: phraseIndex + phrase,
      phase,
      energy: clamp((pulse * 0.72) + (rhythm / 12) * 0.28, 0, 1),
      tapCount,
      lastTap,
    };
  }

  function tap(input = {}) {
    const now = Number.isFinite(input.now) ? input.now : Date.now();
    tapCount += 1;
    lastTap = now;
    phrase = Math.floor(tapCount / 8);
    energy = clamp((input.pulse ?? energy) + 0.18, 0, 1);
    return snapshot({ ...input, now, pulse: energy });
  }

  return { snapshot, tap };
}
