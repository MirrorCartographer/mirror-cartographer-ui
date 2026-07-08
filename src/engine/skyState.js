export const SKY_STATES = ['cloud', 'rain', 'lightning', 'clear', 'aurora', 'dawn', 'wind', 'murmur'];

export const VIEWPORT_BREAKPOINTS = Object.freeze({
  mobileMax: 700,
  smallHeight: 620,
});

export const INPUT_POLICY = Object.freeze({
  quickGestureMs: 620,
  defaultPoint: Object.freeze({ x: 0.5, y: 0.5 }),
  safePointerAction: 'manipulation',
});

export const AUDIO_POLICY = Object.freeze({
  allowAutoplay: false,
  unlockEvent: 'first-user-gesture',
  defaultGain: 0,
});

export const CONTINUITY_POLICY = Object.freeze({
  localMemory: 'off-by-default',
  publicSafeStateOnly: true,
  persistRawGestures: false,
  persistCoordinates: false,
});

export const PERFORMANCE_BUDGET = Object.freeze({
  maxMarks: 28,
  renderedMarks: 24,
  renderedTethers: 5,
  renderedCreatures: 18,
  mobileCreatures: 11,
  renderedFilaments: 6,
  filamentSegments: 14,
  mobileFilamentSegments: 9,
  pressureWakeMarks: 10,
  pressureWakePaths: 22,
  mobilePressureWakePaths: 12,
  pressureWakeSteps: 8,
  mobilePressureWakeSteps: 5,
  trailMemoryMarks: 12,
  trailMemorySparks: 44,
  mobileTrailMemorySparks: 24,
  stormBranchMarks: 7,
  stormBranches: 12,
  mobileStormBranches: 7,
  stormBranchSegments: 9,
  mobileStormBranchSegments: 6,
  nacreBands: 12,
  mobileNacreBands: 7,
  nacreMist: 5,
  mobileNacreMist: 3,
  maxPixelRatio: 2,
  desktopStars: 210,
  mobileStars: 130,
  desktopClouds: 42,
  mobileClouds: 28,
  renderedRainDrops: 235,
  mobileRainDrops: 145,
  renderedSprites: 24,
  mobileSprites: 14,
  renderedPollen: 70,
  mobilePollen: 36,
  renderedRibbons: 9,
  mobileRibbons: 6,
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

export function responsiveBudget(width = 1000, height = 800) {
  const mobile = width < VIEWPORT_BREAKPOINTS.mobileMax;
  const short = height < VIEWPORT_BREAKPOINTS.smallHeight;
  const tiny = mobile && short;
  const motionScale = short ? 0.84 : 1;
  const densityScale = tiny ? 0.78 : short ? 0.88 : 1;
  const count = (value, floor = 1) => Math.max(floor, Math.round(value * densityScale));

  return {
    mobile,
    short,
    tiny,
    motionScale,
    densityScale,
    stars: count(mobile ? PERFORMANCE_BUDGET.mobileStars : PERFORMANCE_BUDGET.desktopStars, 60),
    clouds: count(mobile ? PERFORMANCE_BUDGET.mobileClouds : PERFORMANCE_BUDGET.desktopClouds, 12),
    creatures: count(mobile ? PERFORMANCE_BUDGET.mobileCreatures : PERFORMANCE_BUDGET.renderedCreatures, 7),
    rainDrops: count(mobile ? PERFORMANCE_BUDGET.mobileRainDrops : PERFORMANCE_BUDGET.renderedRainDrops, 70),
    sprites: count(mobile ? PERFORMANCE_BUDGET.mobileSprites : PERFORMANCE_BUDGET.renderedSprites, 8),
    pollen: count(mobile ? PERFORMANCE_BUDGET.mobilePollen : PERFORMANCE_BUDGET.renderedPollen, 18),
    ribbons: count(mobile ? PERFORMANCE_BUDGET.mobileRibbons : PERFORMANCE_BUDGET.renderedRibbons, 4),
    pressureWakeMarks: tiny ? 7 : PERFORMANCE_BUDGET.pressureWakeMarks,
    pressureWakePaths: count(mobile ? PERFORMANCE_BUDGET.mobilePressureWakePaths : PERFORMANCE_BUDGET.pressureWakePaths, 8),
    pressureWakeSteps: tiny ? 4 : mobile ? PERFORMANCE_BUDGET.mobilePressureWakeSteps : PERFORMANCE_BUDGET.pressureWakeSteps,
    trailMemoryMarks: tiny ? 8 : PERFORMANCE_BUDGET.trailMemoryMarks,
    trailMemorySparks: count(mobile ? PERFORMANCE_BUDGET.mobileTrailMemorySparks : PERFORMANCE_BUDGET.trailMemorySparks, 16),
    stormBranchMarks: tiny ? 5 : PERFORMANCE_BUDGET.stormBranchMarks,
    stormBranches: count(mobile ? PERFORMANCE_BUDGET.mobileStormBranches : PERFORMANCE_BUDGET.stormBranches, 5),
    stormBranchSegments: tiny ? 5 : mobile ? PERFORMANCE_BUDGET.mobileStormBranchSegments : PERFORMANCE_BUDGET.stormBranchSegments,
    nacreBands: count(mobile ? PERFORMANCE_BUDGET.mobileNacreBands : PERFORMANCE_BUDGET.nacreBands, 5),
    nacreMist: tiny ? 2 : mobile ? PERFORMANCE_BUDGET.mobileNacreMist : PERFORMANCE_BUDGET.nacreMist,
  };
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

export function normalizePoint(event, fallback = INPUT_POLICY.defaultPoint) {
  const rect = event.currentTarget.getBoundingClientRect();
  const clientX = 'clientX' in event ? event.clientX : rect.left + rect.width * fallback.x;
  const clientY = 'clientY' in event ? event.clientY : rect.top + rect.height * fallback.y;
  return {
    x: clamp01((clientX - rect.left) / Math.max(1, rect.width)),
    y: clamp01((clientY - rect.top) / Math.max(1, rect.height)),
  };
}

export function evolveWeatherGesture({ now, lastTouch, rhythm, pulse, state, point }) {
  const close = now - lastTouch < INPUT_POLICY.quickGestureMs;
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
