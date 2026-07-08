export const SKY_STATES = ['cloud', 'rain', 'lightning', 'clear', 'aurora', 'dawn', 'wind', 'murmur'];

export const VIEWPORT_BREAKPOINTS = Object.freeze({
  mobileMax: 700,
  narrowMobile: 380,
  smallHeight: 620,
  tinyHeight: 540,
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
  renderedCloudBeasts: 8,
  mobileCloudBeasts: 5,
  tinyCloudBeasts: 4,
  renderedFireflies: 30,
  mobileFireflies: 17,
  tinyFireflies: 11,
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
  gestureWellMarks: 6,
  gestureWellParticles: 34,
  mobileGestureWellParticles: 18,
  gestureWellThreads: 5,
  mobileGestureWellThreads: 3,
  gestureWellThreadNodes: 12,
  mobileGestureWellThreadNodes: 7,
  nacreBands: 12,
  mobileNacreBands: 7,
  nacreMist: 5,
  mobileNacreMist: 3,
  causticCells: 18,
  mobileCausticCells: 10,
  causticRays: 30,
  mobileCausticRays: 16,
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
  const narrow = width < VIEWPORT_BREAKPOINTS.narrowMobile;
  const short = height < VIEWPORT_BREAKPOINTS.smallHeight;
  const tiny = mobile && short;
  const ultraTiny = mobile && height < VIEWPORT_BREAKPOINTS.tinyHeight;
  const area = Math.max(1, width * height);
  const targetArea = mobile ? 390 * 760 : 1200 * 900;
  const areaScale = clamp(area / targetArea, mobile ? 0.62 : 0.72, 1);
  const narrowScale = narrow ? 0.88 : 1;
  const motionScale = ultraTiny ? 0.76 : short ? 0.84 : narrow ? 0.9 : 1;
  const densityScale = (ultraTiny ? 0.68 : tiny ? 0.78 : short ? 0.88 : 1) * areaScale * narrowScale;
  const count = (value, floor = 1) => Math.max(floor, Math.round(value * densityScale));
  const causticRayFloor = ultraTiny || narrow ? 6 : tiny ? 8 : mobile ? 10 : 16;

  return {
    mobile,
    narrow,
    short,
    tiny,
    ultraTiny,
    motionScale,
    densityScale,
    stars: count(mobile ? PERFORMANCE_BUDGET.mobileStars : PERFORMANCE_BUDGET.desktopStars, 54),
    clouds: count(mobile ? PERFORMANCE_BUDGET.mobileClouds : PERFORMANCE_BUDGET.desktopClouds, 10),
    creatures: count(mobile ? PERFORMANCE_BUDGET.mobileCreatures : PERFORMANCE_BUDGET.renderedCreatures, 6),
    cloudBeasts: ultraTiny ? 3 : tiny || narrow ? PERFORMANCE_BUDGET.tinyCloudBeasts : mobile ? PERFORMANCE_BUDGET.mobileCloudBeasts : PERFORMANCE_BUDGET.renderedCloudBeasts,
    fireflies: ultraTiny || narrow ? PERFORMANCE_BUDGET.tinyFireflies : count(mobile ? PERFORMANCE_BUDGET.mobileFireflies : PERFORMANCE_BUDGET.renderedFireflies, 10),
    rainDrops: count(mobile ? PERFORMANCE_BUDGET.mobileRainDrops : PERFORMANCE_BUDGET.renderedRainDrops, 62),
    sprites: count(mobile ? PERFORMANCE_BUDGET.mobileSprites : PERFORMANCE_BUDGET.renderedSprites, 7),
    pollen: count(mobile ? PERFORMANCE_BUDGET.mobilePollen : PERFORMANCE_BUDGET.renderedPollen, 16),
    ribbons: count(mobile ? PERFORMANCE_BUDGET.mobileRibbons : PERFORMANCE_BUDGET.renderedRibbons, 3),
    pressureWakeMarks: ultraTiny || narrow ? 5 : tiny ? 7 : PERFORMANCE_BUDGET.pressureWakeMarks,
    pressureWakePaths: count(mobile ? PERFORMANCE_BUDGET.mobilePressureWakePaths : PERFORMANCE_BUDGET.pressureWakePaths, 7),
    pressureWakeSteps: ultraTiny ? 3 : tiny || narrow ? 4 : mobile ? PERFORMANCE_BUDGET.mobilePressureWakeSteps : PERFORMANCE_BUDGET.pressureWakeSteps,
    trailMemoryMarks: ultraTiny || narrow ? 6 : tiny ? 8 : PERFORMANCE_BUDGET.trailMemoryMarks,
    trailMemorySparks: count(mobile ? PERFORMANCE_BUDGET.mobileTrailMemorySparks : PERFORMANCE_BUDGET.trailMemorySparks, 14),
    stormBranchMarks: ultraTiny || narrow ? 4 : tiny ? 5 : PERFORMANCE_BUDGET.stormBranchMarks,
    stormBranches: count(mobile ? PERFORMANCE_BUDGET.mobileStormBranches : PERFORMANCE_BUDGET.stormBranches, 4),
    stormBranchSegments: ultraTiny ? 4 : tiny || narrow ? 5 : mobile ? PERFORMANCE_BUDGET.mobileStormBranchSegments : PERFORMANCE_BUDGET.stormBranchSegments,
    gestureWellMarks: ultraTiny || narrow ? 3 : tiny ? 4 : PERFORMANCE_BUDGET.gestureWellMarks,
    gestureWellParticles: count(mobile ? PERFORMANCE_BUDGET.mobileGestureWellParticles : PERFORMANCE_BUDGET.gestureWellParticles, 8),
    gestureWellThreads: ultraTiny || narrow ? 2 : tiny ? 2 : mobile ? PERFORMANCE_BUDGET.mobileGestureWellThreads : PERFORMANCE_BUDGET.gestureWellThreads,
    gestureWellThreadNodes: ultraTiny ? 5 : tiny || narrow ? 6 : mobile ? PERFORMANCE_BUDGET.mobileGestureWellThreadNodes : PERFORMANCE_BUDGET.gestureWellThreadNodes,
    nacreBands: count(mobile ? PERFORMANCE_BUDGET.mobileNacreBands : PERFORMANCE_BUDGET.nacreBands, 4),
    nacreMist: ultraTiny || narrow ? 1 : tiny ? 2 : mobile ? PERFORMANCE_BUDGET.mobileNacreMist : PERFORMANCE_BUDGET.nacreMist,
    causticCells: count(mobile ? PERFORMANCE_BUDGET.mobileCausticCells : PERFORMANCE_BUDGET.causticCells, 5),
    causticRays: count(mobile ? PERFORMANCE_BUDGET.mobileCausticRays : PERFORMANCE_BUDGET.causticRays, causticRayFloor),
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
  return clamp(value, 0, 1);
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
