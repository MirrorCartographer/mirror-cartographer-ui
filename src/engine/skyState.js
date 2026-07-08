export const SKY_STATES = ['cloud', 'rain', 'lightning', 'clear', 'aurora', 'dawn', 'wind', 'murmur'];

export const PERFORMANCE_BUDGET = Object.freeze({
  maxMarks: 28,
  renderedMarks: 24,
  renderedTethers: 5,
  renderedCreatures: 18,
  mobileCreatures: 11,
  tickMs: 120,
  pulseFloor: 0.18,
  pulseDecay: 0.984,
  rhythmDecay: 0.12,
  maxRhythm: 10,
});

export const SKY_STATE_DEFINITIONS = Object.freeze({
  cloud: {
    sky: ['#060718', '#10162b', '#07070d'],
    mark: '#ffe2bf',
    tether: '255,226,191',
    glyph: 'cloud',
    warmth: 0.48,
    motion: 0.42,
  },
  rain: {
    sky: ['#060718', '#152030', '#07070d'],
    mark: '#91d8ff',
    tether: '145,216,255',
    glyph: 'rain',
    warmth: 0.18,
    motion: 0.74,
  },
  lightning: {
    sky: ['#060718', '#10162b', '#07070d'],
    mark: '#effbff',
    tether: '239,251,255',
    glyph: 'lightning',
    warmth: 0.2,
    motion: 1,
  },
  clear: {
    sky: ['#060718', '#10162b', '#3b2434'],
    mark: '#ffe2bf',
    tether: '255,226,191',
    glyph: 'clear',
    warmth: 0.64,
    motion: 0.24,
  },
  aurora: {
    sky: ['#071827', '#10162b', '#07070d'],
    mark: '#a7f3d0',
    tether: '167,243,208',
    glyph: 'aurora',
    warmth: 0.34,
    motion: 0.66,
  },
  dawn: {
    sky: ['#241738', '#5c2845', '#ff9a76'],
    mark: '#ffd1dc',
    tether: '255,209,220',
    glyph: 'dawn',
    warmth: 0.92,
    motion: 0.58,
  },
  wind: {
    sky: ['#10111f', '#25203a', '#4b342f'],
    mark: '#fff0c7',
    tether: '255,226,191',
    glyph: 'wind',
    warmth: 0.72,
    motion: 0.94,
  },
  murmur: {
    sky: ['#03040d', '#10172a', '#241738'],
    mark: '#c4b5fd',
    tether: '196,181,253',
    glyph: 'aurora',
    warmth: 0.38,
    motion: 1.12,
  },
});

export function skyState(name) {
  return SKY_STATE_DEFINITIONS[name] || SKY_STATE_DEFINITIONS.cloud;
}

export function nextSkyState(current, point, pulse, rhythm) {
  const x = clamp01(point.x);
  const y = clamp01(point.y);
  if (rhythm > 8 && pulse > 0.78) return 'murmur';
  if (rhythm > 7 && pulse > 0.74) return 'wind';
  if (rhythm > 5 && pulse > 0.76) return 'dawn';
  if (pulse > 0.82 && rhythm > 3) return 'lightning';
  if (y > 0.7 && x > 0.68) return 'murmur';
  if (y > 0.7) return 'rain';
  if (x < 0.25) return 'cloud';
  if (x > 0.75) return 'aurora';
  if (y < 0.22) return 'clear';
  return SKY_STATES[(SKY_STATES.indexOf(current) + 1) % SKY_STATES.length];
}

export function normalizePoint(event, fallback = { x: 0.5, y: 0.5 }) {
  const rect = event.currentTarget.getBoundingClientRect();
  const clientX = 'clientX' in event ? event.clientX : rect.left + rect.width * fallback.x;
  const clientY = 'clientY' in event ? event.clientY : rect.top + rect.height * fallback.y;
  return {
    x: clamp01((clientX - rect.left) / Math.max(1, rect.width)),
    y: clamp01((clientY - rect.top) / Math.max(1, rect.height)),
  };
}

export function evolveWeatherGesture({ now, lastTouch, rhythm, pulse, state, point }) {
  const close = now - lastTouch < 620;
  const nextRhythm = close ? rhythm + 1 : Math.max(1, rhythm * 0.4);
  const kind = nextSkyState(state, point, pulse, nextRhythm);
  return {
    close,
    kind,
    rhythm: Math.min(PERFORMANCE_BUDGET.maxRhythm, nextRhythm),
    pulseBoost: close ? 0.34 : 0.24,
  };
}

function clamp01(value) {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}
