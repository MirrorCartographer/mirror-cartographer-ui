import {
  EVENT_ROUTES,
  LAYER_PHASES,
  createRuntimeContext,
  createSceneRegistry,
  createPerformanceEnvelope,
  auditRuntimeSurface,
} from './wordlessRuntime';

export const RUNTIME_CONTRACT_VERSION = 1;

export const ROUTE_CONTRACTS = deepFreeze({
  [EVENT_ROUTES.pointer]: {
    input: 'gesture',
    storesRawInput: false,
    exposesCoordinates: false,
    mayChangeState: true,
    mayUnlockAudio: true,
    mayPersist: false,
  },
  [EVENT_ROUTES.resize]: {
    input: 'viewport',
    storesRawInput: false,
    exposesCoordinates: false,
    mayChangeState: false,
    mayUnlockAudio: false,
    mayPersist: false,
  },
  [EVENT_ROUTES.tick]: {
    input: 'time',
    storesRawInput: false,
    exposesCoordinates: false,
    mayChangeState: false,
    mayUnlockAudio: false,
    mayPersist: false,
  },
  [EVENT_ROUTES.visibility]: {
    input: 'page-lifecycle',
    storesRawInput: false,
    exposesCoordinates: false,
    mayChangeState: false,
    mayUnlockAudio: false,
    mayPersist: false,
  },
  [EVENT_ROUTES.audioUnlock]: {
    input: 'gesture-consent',
    storesRawInput: false,
    exposesCoordinates: false,
    mayChangeState: false,
    mayUnlockAudio: true,
    mayPersist: false,
  },
});

export const MODULE_HOOKS = Object.freeze(['state', 'interact', 'draw', 'budget', 'audit']);

export function createScenePlan(context = createRuntimeContext()) {
  const registry = createSceneRegistry();
  const selected = new Map((context.layers || []).map((layer) => [layer.id, layer]));
  const groups = Object.keys(LAYER_PHASES).map((phase) => {
    const entries = registry.entries
      .filter((layer) => layer.phase === phase)
      .map((layer) => {
        const selectedLayer = selected.get(layer.id) || {};
        return Object.freeze({
          id: layer.id,
          input: layer.input,
          budgetKey: layer.budgetKey || null,
          drawable: selectedLayer.drawable !== false,
          fallback: selectedLayer.fallback || null,
        });
      });
    return Object.freeze({ phase, order: LAYER_PHASES[phase], entries: Object.freeze(entries) });
  });
  return Object.freeze({
    version: RUNTIME_CONTRACT_VERSION,
    publicSafe: true,
    visibleWords: false,
    route: context.route,
    groups: Object.freeze(groups),
  });
}

export function createCapabilitySurface(context = createRuntimeContext()) {
  const audit = auditRuntimeSurface(context);
  const plan = createScenePlan(context);
  return deepFreeze({
    version: RUNTIME_CONTRACT_VERSION,
    publicSafe: audit.publicSafe === true,
    visibleWords: false,
    audioAutoplay: context.audio?.autoplay === true,
    localMemoryEnabled: context.memory?.policy === 'on',
    rawGestureStorage: false,
    frame: frameBudgetGuard(context),
    phases: plan.groups.map((group) => Object.freeze({
      phase: group.phase,
      drawable: group.entries.filter((entry) => entry.drawable).length,
      fallbacks: group.entries.filter((entry) => entry.fallback).length,
    })),
    contracts: Object.fromEntries(Object.entries(ROUTE_CONTRACTS).map(([route, contract]) => [route, publicRouteContract(contract)])),
  });
}

export function frameBudgetGuard(context = createRuntimeContext(), frameMs = 16.7) {
  const envelope = context.envelope || createPerformanceEnvelope({ budget: context.budget });
  const budget = context.budget || {};
  const target = budget.mobile ? 18.5 : 16.7;
  const stress = Math.max(0, frameMs - target) / target;
  const pressure = envelope.withinBudget === false || stress > 0.35;
  return Object.freeze({
    targetMs: target,
    observedMs: Number(frameMs.toFixed(2)),
    pressure: pressure ? 'shed' : stress > 0.12 ? 'trim' : 'clear',
    densityScale: pressure ? Math.max(0.45, (budget.densityScale || 1) * 0.82) : budget.densityScale || 1,
    motionScale: pressure ? Math.max(0.5, (budget.motionScale || 1) * 0.86) : budget.motionScale || 1,
    skipGestureResidue: pressure && Boolean(budget.mobile),
  });
}

export function createTransitionProbe(before = createRuntimeContext(), after = before, packet = {}) {
  const contract = ROUTE_CONTRACTS[packet.route] || null;
  return Object.freeze({
    publicSafe: true,
    visibleWords: false,
    route: packet.route || after.route,
    from: before.state,
    to: after.state,
    stateChanged: before.state !== after.state,
    energyChanged: before.signals?.energy !== after.signals?.energy,
    pressure: after.signals?.pressure || 'clear',
    mayPersist: contract?.mayPersist === true,
    storesRawInput: false,
  });
}

export function composeRuntimeModule({
  id = 'module',
  phase = 'atmosphere',
  hooks = {},
  budgetKey = null,
  reversible = true,
  publicSafe = true,
} = {}) {
  const safeHooks = Object.fromEntries(MODULE_HOOKS.map((name) => [name, typeof hooks[name] === 'function']));
  return Object.freeze({
    id,
    phase,
    budgetKey,
    reversible: Boolean(reversible),
    publicSafe: publicSafe === true,
    visibleWords: false,
    storesRawInput: false,
    hooks: Object.freeze(safeHooks),
  });
}

export function auditArchitectureSurface(context = createRuntimeContext()) {
  const surface = createCapabilitySurface(context);
  const unsafeRoutes = Object.entries(ROUTE_CONTRACTS)
    .filter(([, contract]) => contract.storesRawInput || contract.exposesCoordinates || contract.mayPersist)
    .map(([route]) => route);
  return deepFreeze({
    version: RUNTIME_CONTRACT_VERSION,
    publicSafe: surface.publicSafe && unsafeRoutes.length === 0,
    visibleWords: false,
    unsafeRoutes,
    audioAutoplay: surface.audioAutoplay,
    localMemoryEnabled: surface.localMemoryEnabled,
    framePressure: surface.frame.pressure,
    phaseCount: surface.phases.length,
  });
}

function publicRouteContract(contract = {}) {
  return Object.freeze({
    input: contract.input,
    storesRawInput: contract.storesRawInput === true,
    exposesCoordinates: contract.exposesCoordinates === true,
    mayUnlockAudio: contract.mayUnlockAudio === true,
    mayPersist: contract.mayPersist === true,
  });
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
