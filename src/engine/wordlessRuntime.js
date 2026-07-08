import { AUDIO_POLICY, CONTINUITY_POLICY, INPUT_POLICY, PERFORMANCE_BUDGET, responsiveBudget, skyState } from './skyState';

export const WORDLESS_RUNTIME_VERSION = 1;

export const EVENT_ROUTES = Object.freeze({
  pointer: 'gesture:intent',
  resize: 'viewport:budget',
  tick: 'scene:breath',
  visibility: 'scene:pause',
  audioUnlock: AUDIO_POLICY.unlockEvent,
});

export const LAYER_PHASES = Object.freeze({
  field: 0,
  atmosphere: 1,
  organisms: 2,
  touchMemory: 3,
  signal: 4,
});

export const DEFAULT_LAYER_ORDER = Object.freeze([
  'backgroundGradient',
  'ambientGlow',
  'reactionVeil',
  'pressureWake',
  'windRibbons',
  'stars',
  'clouds',
  'pollen',
  'sprites',
  'creatureEcology',
  'elasticTethers',
  'skyFilaments',
  'gestureMarks',
  'lightning',
  'centralPulse',
]);

export const NULL_AUDIO_HOOK = Object.freeze({
  unlocked: false,
  gain: AUDIO_POLICY.defaultGain,
  autoplay: AUDIO_POLICY.allowAutoplay,
});

export function createRuntimeContext({ width = 1000, height = 800, state = 'cloud', pulse = PERFORMANCE_BUDGET.pulseFloor, rhythm = 0, marks = [] } = {}) {
  const budget = responsiveBudget(width, height);
  return Object.freeze({
    version: WORDLESS_RUNTIME_VERSION,
    route: EVENT_ROUTES.tick,
    width,
    height,
    state,
    spec: skyState(state),
    pulse: clamp01(pulse),
    rhythm: clamp(rhythm, 0, PERFORMANCE_BUDGET.maxRhythm),
    marks: visibleMarks(marks),
    budget,
    audio: NULL_AUDIO_HOOK,
    memory: publicContinuitySnapshot({ state, pulse, rhythm, marks, budget }),
  });
}

export function visibleMarks(marks = [], limit = PERFORMANCE_BUDGET.renderedMarks) {
  if (!Array.isArray(marks)) return [];
  return marks.slice(-limit).filter((mark) => mark && Number.isFinite(mark.x) && Number.isFinite(mark.y));
}

export function budgetedLayer(items = [], budget, key, fallback = 0) {
  if (!Array.isArray(items)) return [];
  const count = Number.isFinite(budget?.[key]) ? budget[key] : fallback;
  return items.slice(0, Math.max(0, count));
}

export function publicContinuitySnapshot({ state = 'cloud', pulse = 0, rhythm = 0, marks = [], budget = {} } = {}) {
  const latest = visibleMarks(marks, 1)[0];
  return Object.freeze({
    policy: CONTINUITY_POLICY.localMemory,
    publicSafe: CONTINUITY_POLICY.publicSafeStateOnly,
    state,
    pulseBand: band(clamp01(pulse), [0.33, 0.66]),
    rhythmBand: band(rhythm / Math.max(1, PERFORMANCE_BUDGET.maxRhythm), [0.33, 0.66]),
    gestureKind: latest?.kind || state,
    viewport: budget.mobile ? 'small' : budget.short ? 'low' : 'open',
  });
}

export function transitionPacket({ from = 'cloud', to = 'cloud', point = INPUT_POLICY.defaultPoint, pulse = 0, rhythm = 0 } = {}) {
  const safePoint = normalizeSoftPoint(point);
  return Object.freeze({
    from,
    to,
    route: EVENT_ROUTES.pointer,
    intent: inferIntent(safePoint, pulse, rhythm),
    energy: band(clamp01(pulse), [0.4, 0.78]),
    cadence: band(rhythm / Math.max(1, PERFORMANCE_BUDGET.maxRhythm), [0.35, 0.72]),
  });
}

export function shouldSkipHeavyLayer(context, layerCost = 1) {
  const budget = context?.budget || {};
  const mobilePenalty = budget.mobile ? 1.8 : 1;
  const shortPenalty = budget.short ? 1.25 : 1;
  return layerCost * mobilePenalty * shortPenalty > 2.4;
}

export function makeLocalMemoryBridge(storage = null) {
  const enabled = CONTINUITY_POLICY.localMemory === 'on';
  return Object.freeze({
    enabled,
    read() {
      if (!enabled || !storage) return null;
      try {
        return JSON.parse(storage.getItem('mc:wordless-continuity') || 'null');
      } catch {
        return null;
      }
    },
    write(snapshot) {
      if (!enabled || !storage || !snapshot?.publicSafe) return false;
      try {
        storage.setItem('mc:wordless-continuity', JSON.stringify(snapshot));
        return true;
      } catch {
        return false;
      }
    },
  });
}

function inferIntent(point, pulse, rhythm) {
  if (rhythm > 7 && pulse > 0.7) return 'summon';
  if (point.y > 0.72) return 'sink';
  if (point.y < 0.24) return 'lift';
  if (point.x < 0.24) return 'gather';
  if (point.x > 0.76) return 'open';
  return 'turn';
}

function normalizeSoftPoint(point) {
  return {
    x: clamp01(point?.x ?? INPUT_POLICY.defaultPoint.x),
    y: clamp01(point?.y ?? INPUT_POLICY.defaultPoint.y),
  };
}

function band(value, cuts) {
  if (value < cuts[0]) return 'low';
  if (value < cuts[1]) return 'middle';
  return 'high';
}

function clamp01(value) {
  return clamp(value, 0, 1);
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
