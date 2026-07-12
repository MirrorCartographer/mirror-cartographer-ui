import { createHash, randomUUID } from 'node:crypto';

const TYPES = new Set(['idea','context','observation','symbol','emotion','hypothesis','mechanism','experiment','artifact','world']);
const RELATIONS = new Set(['supports','contradicts','causes','enables','blocks','contains','transforms','resembles','measures','implements','emerges_from']);

const stable = (value) => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
    : value;

export const digest = (value) => createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');

export class SemanticOS {
  constructor(seed = {}) {
    this.objects = new Map();
    this.edges = new Map();
    this.contexts = new Map();
    this.transitions = [];
    this.experiments = new Map();
    this.worlds = new Map();
    this.activeContextId = null;
    this.clock = 0;
    for (const object of seed.objects ?? []) this.put(object);
    for (const edge of seed.edges ?? []) this.link(edge);
  }

  now() { this.clock += 1; return this.clock; }

  put(input) {
    if (!input || !TYPES.has(input.type)) throw new TypeError(`invalid semantic type: ${input?.type}`);
    const id = input.id ?? randomUUID();
    const previous = this.objects.get(id);
    const object = {
      id,
      type: input.type,
      label: input.label ?? id,
      data: structuredClone(input.data ?? {}),
      confidence: input.confidence ?? previous?.confidence ?? 0.5,
      state: input.state ?? previous?.state ?? 'active',
      version: (previous?.version ?? 0) + 1,
      createdAt: previous?.createdAt ?? this.now(),
      updatedAt: this.now(),
      provenance: [...(previous?.provenance ?? []), ...(input.provenance ?? [])]
    };
    object.digest = digest(object);
    this.objects.set(id, object);
    if (object.type === 'context') this.contexts.set(id, object);
    return structuredClone(object);
  }

  mutate(id, patch, reason = 'unspecified') {
    const current = this.require(id);
    return this.put({ ...current, ...patch, id, provenance: [{ kind: 'mutation', reason, at: this.now() }] });
  }

  link(input) {
    this.require(input.from); this.require(input.to);
    if (!RELATIONS.has(input.relation)) throw new TypeError(`invalid relation: ${input.relation}`);
    const id = input.id ?? `${input.from}:${input.relation}:${input.to}`;
    const edge = {
      id,
      from: input.from,
      to: input.to,
      relation: input.relation,
      weight: input.weight ?? 1,
      confidence: input.confidence ?? 0.5,
      validFrom: input.validFrom ?? this.now(),
      validTo: input.validTo ?? null,
      contextIds: [...new Set(input.contextIds ?? [])],
      provenance: input.provenance ?? []
    };
    edge.digest = digest(edge);
    this.edges.set(id, edge);
    return structuredClone(edge);
  }

  require(id) {
    const value = this.objects.get(id);
    if (!value) throw new Error(`unknown semantic object: ${id}`);
    return value;
  }

  visibleSet(contextId) {
    const context = this.require(contextId);
    const includeTypes = new Set(context.data.includeTypes ?? [...TYPES]);
    const excludeTypes = new Set(context.data.excludeTypes ?? []);
    const includeIds = new Set(context.data.includeIds ?? []);
    const excludeIds = new Set(context.data.excludeIds ?? []);
    const objects = [...this.objects.values()].filter((object) =>
      object.state === 'active' &&
      !excludeIds.has(object.id) &&
      (includeIds.has(object.id) || (includeTypes.has(object.type) && !excludeTypes.has(object.type)))
    );
    const ids = new Set(objects.map((object) => object.id));
    const edges = [...this.edges.values()].filter((edge) =>
      edge.validTo === null && ids.has(edge.from) && ids.has(edge.to) &&
      (edge.contextIds.length === 0 || edge.contextIds.includes(contextId))
    );
    return { objects, edges };
  }

  infer(contextId) {
    const { objects, edges } = this.visibleSet(contextId);
    const labels = new Map(objects.map((o) => [o.id, o.label]));
    const inferences = [];
    for (const first of edges) {
      for (const second of edges) {
        if (first.to !== second.from) continue;
        if (first.relation === 'supports' && second.relation === 'supports') {
          inferences.push({
            kind: 'transitive_support',
            from: first.from,
            through: first.to,
            to: second.to,
            statement: `${labels.get(first.from)} indirectly supports ${labels.get(second.to)} through ${labels.get(first.to)}`,
            confidence: Math.min(first.confidence, second.confidence) * 0.9
          });
        }
        if (first.relation === 'causes' && second.relation === 'enables') {
          inferences.push({
            kind: 'causal_enablement',
            from: first.from,
            through: first.to,
            to: second.to,
            statement: `${labels.get(first.from)} may enable ${labels.get(second.to)} by causing ${labels.get(first.to)}`,
            confidence: Math.min(first.confidence, second.confidence) * 0.8
          });
        }
      }
    }
    return [...new Map(inferences.map((x) => [digest(x), x])).values()];
  }

  switchContext(toContextId, trigger = {}) {
    const beforeId = this.activeContextId;
    const before = beforeId ? this.visibleSet(beforeId) : { objects: [], edges: [] };
    const beforeInference = beforeId ? this.infer(beforeId) : [];
    const after = this.visibleSet(toContextId);
    const afterInference = this.infer(toContextId);
    const beforeObjectIds = new Set(before.objects.map((x) => x.id));
    const afterObjectIds = new Set(after.objects.map((x) => x.id));
    const beforeInferenceIds = new Set(beforeInference.map(digest));
    const afterInferenceIds = new Set(afterInference.map(digest));
    const transition = {
      id: randomUUID(),
      fromContextId: beforeId,
      toContextId,
      why: {
        trigger: trigger.kind ?? 'manual',
        evidence: trigger.evidence ?? [],
        goal: trigger.goal ?? null,
        contradiction: trigger.contradiction ?? null,
        score: trigger.score ?? null
      },
      becameVisible: [...afterObjectIds].filter((id) => !beforeObjectIds.has(id)),
      becameImpossible: [...beforeObjectIds].filter((id) => !afterObjectIds.has(id)),
      newInferences: afterInference.filter((x) => !beforeInferenceIds.has(digest(x))),
      lostInferences: beforeInference.filter((x) => !afterInferenceIds.has(digest(x))),
      at: this.now()
    };
    transition.digest = digest(transition);
    this.activeContextId = toContextId;
    this.transitions.push(transition);
    return structuredClone(transition);
  }

  proposeHypothesis({ label, observations = [], mechanism = null, contextId = this.activeContextId }) {
    const hypothesis = this.put({
      type: 'hypothesis', label,
      confidence: 0.25,
      data: { observations, mechanism, contextId, status: 'candidate' },
      provenance: [{ kind: 'generated', from: observations }]
    });
    for (const observationId of observations) this.link({ from: observationId, to: hypothesis.id, relation: 'supports', confidence: 0.45, contextIds: contextId ? [contextId] : [] });
    if (mechanism) this.link({ from: mechanism, to: hypothesis.id, relation: 'enables', confidence: 0.5, contextIds: contextId ? [contextId] : [] });
    return hypothesis;
  }

  designExperiment({ hypothesisId, variable, intervention, expected, falsifier }) {
    const hypothesis = this.require(hypothesisId);
    if (hypothesis.type !== 'hypothesis') throw new TypeError('experiment target must be a hypothesis');
    const experiment = this.put({
      type: 'experiment',
      label: `Test: ${hypothesis.label}`,
      data: { hypothesisId, variable, intervention, expected, falsifier, status: 'designed', results: [] },
      confidence: 0.5
    });
    this.link({ from: experiment.id, to: hypothesisId, relation: 'measures', confidence: 1 });
    this.experiments.set(experiment.id, experiment);
    return experiment;
  }

  recordResult(experimentId, result) {
    const experiment = this.require(experimentId);
    const results = [...experiment.data.results, result];
    const updated = this.mutate(experimentId, { data: { ...experiment.data, results, status: 'observed' } }, 'experiment result');
    const hypothesis = this.require(experiment.data.hypothesisId);
    const support = result.outcome === 'supports' ? 0.18 : result.outcome === 'contradicts' ? -0.28 : 0;
    const confidence = Math.max(0, Math.min(1, hypothesis.confidence + support * (result.quality ?? 0.5)));
    const updatedHypothesis = this.mutate(hypothesis.id, {
      confidence,
      data: { ...hypothesis.data, status: confidence > 0.7 ? 'provisionally_supported' : confidence < 0.15 ? 'provisionally_rejected' : 'candidate' }
    }, `experiment ${experimentId}: ${result.outcome}`);
    return { experiment: updated, hypothesis: updatedHypothesis };
  }

  emotionalFrame({ label, dimensions, symbols = [] }) {
    const emotion = this.put({ type: 'emotion', label, data: { dimensions, symbols } });
    return {
      object: emotion,
      visual: {
        radius: 20 + 80 * Math.max(0, Math.min(1, dimensions.intensity ?? 0.5)),
        pulseHz: 0.2 + 2.8 * Math.max(0, Math.min(1, dimensions.activation ?? 0.5)),
        tension: Math.max(0, Math.min(1, dimensions.constraint ?? 0.5)),
        coherence: Math.max(0, Math.min(1, dimensions.coherence ?? 0.5)),
        orbitCount: symbols.length,
        topology: (dimensions.valence ?? 0) >= 0 ? 'expanding' : 'contracting'
      }
    };
  }

  evolveWorld({ label, rules, seedObjects = [] }) {
    const world = this.put({ type: 'world', label, data: { rules, generation: 0, entities: seedObjects } });
    this.worlds.set(world.id, world);
    return world;
  }

  stepWorld(worldId, input = {}) {
    const world = this.require(worldId);
    const generation = world.data.generation + 1;
    const entities = world.data.entities.map((entity, index) => ({
      ...entity,
      phase: ((entity.phase ?? index / Math.max(1, world.data.entities.length)) + (input.delta ?? 0.01) * (entity.speed ?? 1)) % 1,
      energy: Math.max(0, Math.min(1, (entity.energy ?? 0.5) + (input.energy ?? 0) - (world.data.rules.decay ?? 0.001)))
    }));
    return this.mutate(worldId, { data: { ...world.data, generation, entities, lastInput: input } }, 'world step');
  }

  browserWorkspace() {
    return {
      open: (resource) => this.put({ type: 'artifact', label: resource.title ?? resource.url ?? 'resource', data: { resource, annotations: [], comparisons: [] } }),
      annotate: (artifactId, annotation) => {
        const artifact = this.require(artifactId);
        return this.mutate(artifactId, { data: { ...artifact.data, annotations: [...artifact.data.annotations, annotation] } }, 'browser annotation');
      },
      compare: (leftId, rightId, dimensions) => {
        const left = this.require(leftId); const right = this.require(rightId);
        const comparison = this.put({ type: 'artifact', label: `${left.label} ↔ ${right.label}`, data: { leftId, rightId, dimensions } });
        this.link({ from: comparison.id, to: leftId, relation: 'contains', confidence: 1 });
        this.link({ from: comparison.id, to: rightId, relation: 'contains', confidence: 1 });
        return comparison;
      }
    };
  }

  snapshot() {
    const state = {
      schemaVersion: 1,
      activeContextId: this.activeContextId,
      objects: [...this.objects.values()],
      edges: [...this.edges.values()],
      transitions: this.transitions
    };
    return { ...structuredClone(state), digest: digest(state) };
  }
}
