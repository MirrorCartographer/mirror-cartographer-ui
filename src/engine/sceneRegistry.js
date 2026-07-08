import {
  AUDIO_POLICY,
  CONTINUITY_POLICY,
  PERFORMANCE_BUDGET,
  SKY_STATES,
  responsiveBudget,
  skyState,
} from './skyState';

export const SCENE_LAYER_ORDER = Object.freeze([
  'background',
  'ambientGlow',
  'ribbons',
  'stars',
  'clouds',
  'pollen',
  'sprites',
  'creatures',
  'tethers',
  'filaments',
  'marks',
  'precipitation',
  'lightning',
  'heart',
  'htmlGlyph',
]);

export const SCENE_REGISTRY = Object.freeze({
  background: Object.freeze({ always: true, budget: 'fill' }),
  ambientGlow: Object.freeze({ always: true, budget: 'gradient' }),
  ribbons: Object.freeze({ states: ['wind', 'aurora', 'dawn', 'murmur'], pulseGate: 0.7 }),
  stars: Object.freeze({ always: true, budget: 'stars' }),
  clouds: Object.freeze({ always: true, budget: 'clouds' }),
  pollen: Object.freeze({ states: ['wind', 'dawn', 'murmur'], pulseGate: 0.66 }),
  sprites: Object.freeze({ always: true, budget: 'fixed-small' }),
  creatures: Object.freeze({ always: true, budget: 'creatures' }),
  tethers: Object.freeze({ needsMarks: true, budget: 'renderedTethers' }),
  filaments: Object.freeze({ needsMarks: true, budget: 'renderedFilaments' }),
  marks: Object.freeze({ needsMarks: true, budget: 'renderedMarks' }),
  precipitation: Object.freeze({ states: ['rain'], budget: 'rain' }),
  lightning: Object.freeze({ states: ['lightning'], budget: 'burst' }),
  heart: Object.freeze({ always: true, budget: 'single-path' }),
  htmlGlyph: Object.freeze({ always: true, budget: 'dom-small' }),
});

export const EVENT_ROUTES = Object.freeze({
  pointer: Object.freeze({
    target: 'weatherGesture',
    persists: false,
    exposesText: false,
  }),
  resize: Object.freeze({
    target: 'viewportBudget',
    persists: false,
    exposesText: false,
  }),
  firstGestureAudioUnlock: Object.freeze({
    target: 'futureAudioOnly',
    enabled: !AUDIO_POLICY.allowAutoplay,
    persists: false,
    exposesText: false,
  }),
  continuitySnapshot: Object.freeze({
    target: 'futurePublicSafeMemoryOnly',
    enabled: CONTINUITY_POLICY.localMemory !== 'off-by-default',
    persists: CONTINUITY_POLICY.publicSafeStateOnly,
    exposesText: false,
  }),
});

export function sceneContext({ state, width, height, pulse = 0, rhythm = 0, marks = [] }) {
  const kind = SKY_STATES.includes(state) ? state : 'cloud';
  const viewport = responsiveBudget(width, height);
  const spec = skyState(kind);
  const markCount = Array.isArray(marks) ? marks.length : 0;
  const context = {
    kind,
    spec,
    viewport,
    pulse,
    rhythm,
    markCount,
    budget: Object.freeze({
      ...viewport,
      marks: PERFORMANCE_BUDGET.renderedMarks,
      tethers: PERFORMANCE_BUDGET.renderedTethers,
      filaments: PERFORMANCE_BUDGET.renderedFilaments,
      maxPixelRatio: PERFORMANCE_BUDGET.maxPixelRatio,
    }),
  };

  return Object.freeze({
    ...context,
    activeLayers: activeSceneLayers(context),
  });
}

export function activeSceneLayers(context) {
  return SCENE_LAYER_ORDER.filter((layer) => layerEnabled(layer, context));
}

export function layerEnabled(layer, context) {
  const rule = SCENE_REGISTRY[layer];
  if (!rule) return false;
  if (rule.needsMarks && !context.markCount) return false;
  if (rule.always) return true;
  if (rule.states?.includes(context.kind)) return true;
  if (typeof rule.pulseGate === 'number' && context.pulse >= rule.pulseGate) return true;
  return false;
}

export function transitionPacket({ from, to, point, pulse, rhythm }) {
  return Object.freeze({
    from: SKY_STATES.includes(from) ? from : 'cloud',
    to: SKY_STATES.includes(to) ? to : 'cloud',
    zone: pointZone(point),
    pulse: quantize(pulse),
    rhythm: quantize(rhythm),
    publicSafe: true,
    exposesText: false,
    reversible: true,
  });
}

function pointZone(point = { x: 0.5, y: 0.5 }) {
  const x = point.x < 0.33 ? 'left' : point.x > 0.67 ? 'right' : 'center';
  const y = point.y < 0.33 ? 'high' : point.y > 0.67 ? 'low' : 'middle';
  return `${y}-${x}`;
}

function quantize(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}
