import {
  AUDIO_POLICY,
  CONTINUITY_POLICY,
  INPUT_POLICY,
  PERFORMANCE_BUDGET,
  evolveWeatherGesture,
  normalizePoint,
  responsiveBudget,
  skyState,
} from './skyState';

export const WORDLESS_RUNTIME_VERSION = 5;

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

export const RUNTIME_FLAGS = deepFreeze({
  localContinuity: reversibleExperimentToken({ name: 'local-continuity', enabled: false, weight: 0, expires: 'manual' }),
  audioAfterGesture: reversibleExperimentToken({ name: 'audio-after-gesture', enabled: false, weight: 0, expires: 'manual' }),
  layerEnvelope: reversibleExperimentToken({ name: 'layer-envelope', enabled: true, weight: 1, expires: 'manual' }),
});

export const LAYER_REGISTRY = deepFreeze([
  { id: 'backgroundGradient', phase: 'field', cost: 0.2, input: 'none', fallback: 'flatSky' },
  { id: 'ambientGlow', phase: 'field', cost: 0.35, input: 'state', fallback: 'dimGlow' },
  { id: 'reactionVeil', phase: 'atmosphere', cost: 1.15, input: 'gesture-memory', fallback: 'skip' },
  { id: 'pressureWake', phase: 'touchMemory', cost: 1.2, input: 'gesture-memory', budgetKey: 'pressureWakePaths', fallback: 'skip' },
  { id: 'gestureWells', phase: 'touchMemory', cost: 1.18, input: 'gesture-memory', budgetKey: 'gestureWellParticles', fallback: 'fewerOrbits' },
  { id: 'trailMemory', phase: 'touchMemory', cost: 0.95, input: 'gesture-memory', budgetKey: 'trailMemorySparks', fallback: 'skip' },
  { id: 'windRibbons', phase: 'atmosphere', cost: 0.72, input: 'state-rhythm', budgetKey: 'ribbons', fallback: 'thinRibbon' },
  { id: 'stars', phase: 'atmosphere', cost: 0.38, input: 'state', budgetKey: 'stars', fallback: 'fewerPoints' },
  { id: 'clouds', phase: 'atmosphere', cost: 0.62, input: 'state', budgetKey: 'clouds', fallback: 'fewerClouds' },
  { id: 'nacreVeil', phase: 'atmosphere', cost: 0.86, input: 'state-gesture', budgetKey: 'nacreBands', fallback: 'thinVeil' },
  { id: 'skyCaustics', phase: 'atmosphere', cost: 0.84, input: 'state-gesture', budgetKey: 'causticCells', fallback: 'softCaustics' },
  { id: 'pollen', phase: 'atmosphere', cost: 0.45, input: 'state-rhythm', budgetKey: 'pollen', fallback: 'skip' },
  { id: 'sprites', phase: 'organisms', cost: 0.7, input: 'state-rhythm', budgetKey: 'sprites', fallback: 'fewerSprites' },
  { id: 'creatureEcology', phase: 'organisms', cost: 1.05, input: 'gesture-memory', budgetKey: 'creatures', fallback: 'reducedFlock' },
  { id: 'cloudBeasts', phase: 'organisms', cost: 1.08, input: 'gesture-memory', budgetKey: 'cloudBeasts', fallback: 'reducedHerd' },
  { id: 'stormBranches', phase: 'organisms', cost: 1.22, input: 'gesture-memory', budgetKey: 'stormBranches', fallback: 'shortBranches' },
  { id: 'elasticTethers', phase: 'signal', cost: 0.5, input: 'latest-gesture', fallback: 'skip' },
  { id: 'skyFilaments', phase: 'signal', cost: 0.82, input: 'gesture-memory', fallback: 'shortFilaments' },
  { id: 'gestureMarks', phase: 'signal', cost: 0.32, input: 'latest-gesture', budgetKey: 'renderedMarks', fallback: 'fewerMarks' },
  { id: 'rain', phase: 'signal', cost: 0.78, input: 'state-pulse', budgetKey: 'rainDrops', fallback: 'lighterRain' },
  { id: 'lightning', phase: 'signal', cost: 0.58, input: 'state-pulse', fallback: 'flashOnly' },
  { id: 'centralPulse', phase: 'signal', cost: 0.28, input: 'state-pulse', fallback: 'smallPulse' },
]);

export const DEFAULT_LAYER_ORDER = Object.freeze(LAYER_REGISTRY.map((layer) => layer.id));

export const NULL_AUDIO_HOOK = Object.freeze({
  unlocked: false,
  gain: AUDIO_POLICY.defaultGain,
  autoplay: AUDIO_POLICY.allowAutoplay,
});

export function createRuntimeContext({ width = 1000, height = 800, state = 'cloud', pulse = PERFORMANCE_BUDGET.pulseFloor, rhythm = 0, marks = [], transitions = [], route = EVENT_ROUTES.tick, time = 0 } = {}) {
  const budget = responsiveBudget(width, height);
  return Object.freeze({
    version: WORDLESS_RUNTIME_VERSION,
    route,
    time,
    width,
    height,
    state,
    spec: skyState(state),
    pulse: clamp01(pulse),
    rhythm: clamp(rhythm, 0, PERFORMANCE_BUDGET.maxRhythm),
    marks: visibleMarks(marks),
    transitions: redactTransitions(transitions),
    budget,
    layers: selectSceneLayers(budget, LAYER_REGISTRY),
    envelope: createPerformanceEnvelope({ budget, layers: LAYER_REGISTRY }),
    audio: NULL_AUDIO_HOOK,
    memory: publicContinuitySnapshot({ state, pulse, rhythm, marks, budget, transitions }),
  });
}

export function createRuntimeStore(initial = {}) {
  let context = createRuntimeContext(initial);
  const listeners = new Set();
  return Object.freeze({
    read() {
      return context;
    },
    subscribe(listener) {
      if (typeof listener !== 'function') return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    transition(packet = {}) {
      const previous = context;
      context = reduceRuntimeContext(context, packet);
      if (context !== previous) listeners.forEach((listener) => listener(context, previous, packet));
      return context;
    },
  });
}

export function reduceRuntimeContext(context = createRuntimeContext(), packet = {}) {
  if (!packet || !packet.route) return context;
  if (packet.route === EVENT_ROUTES.resize) {
    return createRuntimeContext({ ...context, width: packet.width, height: packet.height, route: packet.route, time: packet.time ?? context.time });
  }
  if (packet.route === EVENT_ROUTES.tick) {
    return createRuntimeContext({
      ...context,
      route: packet.route,
      time: packet.time ?? context.time + 1,
      pulse: Math.max(PERFORMANCE_BUDGET.pulseFloor, context.pulse * PERFORMANCE_BUDGET.pulseDecay),
      rhythm: Math.max(0, context.rhythm - PERFORMANCE_BUDGET.rhythmDecay),
    });
  }
  if (packet.route === EVENT_ROUTES.pointer) {
    const transition = packet.transition || transitionPacket({ from: context.state, to: packet.gesture?.kind || context.state, point: packet.point, pulse: context.pulse, rhythm: context.rhythm });
    return createRuntimeContext({
      ...context,
      route: packet.route,
      time: packet.mark?.time ?? packet.time ?? context.time,
      state: packet.gesture?.kind || transition.to || context.state,
      pulse: Math.min(1, context.pulse + (packet.gesture?.pulseBoost ?? 0.24)),
      rhythm: packet.gesture?.rhythm ?? context.rhythm,
      marks: [...context.marks.slice(-PERFORMANCE_BUDGET.maxMarks), packet.mark].filter(Boolean),
      transitions: [...(context.transitions || []), transition],
    });
  }
  return createRuntimeContext({ ...context, route: packet.route, time: packet.time ?? context.time });
}

export function createInputRouter({ getContext = () => createRuntimeContext(), now = () => Date.now() } = {}) {
  let lastTouch = 0;
  return Object.freeze({
    pointer(event) {
      const context = getContext();
      const packet = routePointerGesture({ event, now: now(), lastTouch, rhythm: context.rhythm, pulse: context.pulse, state: context.state, marks: context.marks });
      lastTouch = packet.mark.time;
      return packet;
    },
    resize(width, height) {
      return routeViewportResize({ width, height, time: now() });
    },
    tick(time = now()) {
      return Object.freeze({ route: EVENT_ROUTES.tick, time });
    },
    visibility(hidden = false) {
      return Object.freeze({ route: EVENT_ROUTES.visibility, hidden: Boolean(hidden), time: now() });
    },
  });
}

export function routeViewportResize({ width = 1000, height = 800, time = Date.now() } = {}) {
  const budget = responsiveBudget(width, height);
  return Object.freeze({
    route: EVENT_ROUTES.resize,
    width: Math.max(1, Number(width) || 1),
    height: Math.max(1, Number(height) || 1),
    time,
    budget,
    envelope: createPerformanceEnvelope({ budget }),
  });
}

export function createSceneRegistry(layers = LAYER_REGISTRY) {
  const entries = layers.map((layer, index) => Object.freeze({
    ...layer,
    index,
    phaseOrder: LAYER_PHASES[layer.phase] ?? 99,
  }));
  return Object.freeze({
    entries,
    order: Object.freeze([...entries].sort(compareLayers).map((layer) => layer.id)),
    byId: Object.freeze(Object.fromEntries(entries.map((layer) => [layer.id, layer]))),
  });
}

export function selectSceneLayers(budget = {}, layers = LAYER_REGISTRY) {
  const registry = createSceneRegistry(layers);
  return Object.freeze(registry.order.map((id) => {
    const layer = registry.byId[id];
    const available = layerIsAvailable(layer, budget);
    return Object.freeze({
      id,
      phase: layer.phase,
      input: layer.input,
      drawable: available,
      fallback: available ? null : layer.fallback,
    });
  }));
}

export function createPerformanceEnvelope({ budget = {}, layers = LAYER_REGISTRY } = {}) {
  const selected = selectSceneLayers(budget, layers);
  const activeCost = selected.reduce((sum, layer) => {
    if (!layer.drawable) return sum;
    const spec = layers.find((item) => item.id === layer.id);
    return sum + (spec?.cost || 0);
  }, 0);
  const scale = budget.motionScale ?? 1;
  const ceiling = budget.mobile ? 10.2 : 15.8;
  return Object.freeze({
    densityScale: budget.densityScale ?? 1,
    motionScale: scale,
    activeCost: Number(activeCost.toFixed(3)),
    ceiling,
    withinBudget: activeCost <= ceiling,
    drawableCount: selected.filter((layer) => layer.drawable).length,
    fallbackCount: selected.filter((layer) => !layer.drawable).length,
  });
}

export function composePrimitive({ id = 'primitive', phase = 'atmosphere', cost = 0.5, input = 'state', budgetKey = null, fallback = 'skip', draw = null } = {}) {
  return Object.freeze({
    id,
    phase,
    cost: clamp(Number(cost), 0, 3),
    input,
    budgetKey,
    fallback,
    draw: typeof draw === 'function' ? draw : null,
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

export function routePointerGesture({ event, now = Date.now(), lastTouch = 0, rhythm = 0, pulse = 0, state = 'cloud', marks = [] } = {}) {
  const point = event ? normalizePoint(event) : INPUT_POLICY.defaultPoint;
  const gesture = evolveWeatherGesture({ now, lastTouch, rhythm, pulse, state, point });
  const prev = visibleMarks(marks, 1)[0] || null;
  const mark = Object.freeze({ ...point, prev, time: now, spin: seededSpin(now, point), kind: gesture.kind });
  return Object.freeze({
    route: EVENT_ROUTES.pointer,
    point,
    gesture,
    mark,
    transition: transitionPacket({ from: state, to: gesture.kind, point, pulse: Math.min(1, pulse + gesture.pulseBoost), rhythm: gesture.rhythm }),
  });
}

export function createTransitionLedger(limit = 18) {
  const packets = [];
  return Object.freeze({
    push(packet) {
      if (!packet || packet.route !== EVENT_ROUTES.pointer) return Object.freeze([...packets]);
      packets.push(redactTransitionPacket(packet.transition || packet));
      while (packets.length > limit) packets.shift();
      return Object.freeze([...packets]);
    },
    snapshot() {
      return Object.freeze([...packets]);
    },
    clear() {
      packets.length = 0;
      return Object.freeze([]);
    },
  });
}

export function publicContinuitySnapshot({ state = 'cloud', pulse = 0, rhythm = 0, marks = [], budget = {}, transitions = [] } = {}) {
  const latest = visibleMarks(marks, 1)[0];
  const lastTransition = Array.isArray(transitions) ? transitions.at(-1) : null;
  return Object.freeze({
    policy: CONTINUITY_POLICY.localMemory,
    publicSafe: CONTINUITY_POLICY.publicSafeStateOnly,
    state,
    pulseBand: band(clamp01(pulse), [0.33, 0.66]),
    rhythmBand: band(rhythm / Math.max(1, PERFORMANCE_BUDGET.maxRhythm), [0.33, 0.66]),
    gestureKind: latest?.kind || state,
    transitionIntent: lastTransition?.intent || 'none',
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

export function reversibleExperimentToken({ name = 'unnamed', enabled = false, weight = 0, expires = 'manual' } = {}) {
  return Object.freeze({
    name,
    enabled: Boolean(enabled),
    weight: clamp(Number(weight), 0, 1),
    expires,
    publicSafe: true,
    storesGestureData: false,
  });
}

export function auditRuntimeSurface(context = createRuntimeContext()) {
  const registry = createSceneRegistry();
  const selectedIds = new Set((context.layers || []).map((layer) => layer.id));
  const hiddenLayers = registry.entries.filter((layer) => !selectedIds.has(layer.id)).map((layer) => layer.id);
  const heavyFallbacks = (context.layers || []).filter((layer) => !layer.drawable).map((layer) => layer.fallback).filter(Boolean);
  return Object.freeze({
    version: WORDLESS_RUNTIME_VERSION,
    layerCount: registry.entries.length,
    drawableCount: (context.layers || []).filter((layer) => layer.drawable).length,
    hiddenLayers: Object.freeze(hiddenLayers),
    fallbacks: Object.freeze(heavyFallbacks),
    publicSafe: context.memory?.publicSafe === true && context.audio?.autoplay === false,
    storesGestureData: false,
    envelope: context.envelope || createPerformanceEnvelope({ budget: context.budget }),
  });
}

export function shouldSkipHeavyLayer(context, layerCost = 1) {
  const budget = context?.budget || {};
  const mobilePenalty = budget.mobile ? 1.8 : 1;
  const shortPenalty = budget.short ? 1.25 : 1;
  return layerCost * mobilePenalty * shortPenalty > 2.4;
}

export function makeAudioUnlockBridge({ context = null, gain = AUDIO_POLICY.defaultGain } = {}) {
  let unlocked = false;
  return Object.freeze({
    read() {
      return Object.freeze({ unlocked, gain: unlocked ? gain : AUDIO_POLICY.defaultGain, autoplay: AUDIO_POLICY.allowAutoplay, context: context ? 'provided' : 'none' });
    },
    unlock(eventRoute = EVENT_ROUTES.pointer) {
      if (eventRoute !== EVENT_ROUTES.pointer && eventRoute !== EVENT_ROUTES.audioUnlock) return this.read();
      unlocked = true;
      return this.read();
    },
  });
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

function compareLayers(a, b) {
  return a.phaseOrder - b.phaseOrder || a.index - b.index;
}

function layerIsAvailable(layer, budget) {
  if (!layer) return false;
  if (layer.budgetKey && Number.isFinite(budget?.[layer.budgetKey]) && budget[layer.budgetKey] <= 0) return false;
  const context = { budget };
  return !shouldSkipHeavyLayer(context, layer.cost);
}

function inferIntent(point, pulse, rhythm) {
  if (rhythm > 7 && pulse > 0.7) return 'summon';
  if (point.y > 0.72) return 'sink';
  if (point.y < 0.24) return 'lift';
  if (point.x < 0.24) return 'gather';
  if (point.x > 0.76) return 'open';
  return 'turn';
}

function seededSpin(now, point) {
  const seed = Math.sin(now * 0.001 + point.x * 12.9898 + point.y * 78.233) * 43758.5453;
  return (seed - Math.floor(seed)) * Math.PI * 2;
}

function redactTransitions(transitions = []) {
  if (!Array.isArray(transitions)) return [];
  return Object.freeze(transitions.slice(-18).map((packet) => redactTransitionPacket(packet)));
}

function redactTransitionPacket(packet = {}) {
  return Object.freeze({
    from: packet.from,
    to: packet.to,
    route: packet.route,
    intent: packet.intent,
    energy: packet.energy,
    cadence: packet.cadence,
  });
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

function deepFreeze(value) {
  if (Array.isArray(value)) return Object.freeze(value.map((item) => deepFreeze(item)));
  if (value && typeof value === 'object') {
    Object.keys(value).forEach((key) => {
      value[key] = deepFreeze(value[key]);
    });
    return Object.freeze(value);
  }
  return value;
}
