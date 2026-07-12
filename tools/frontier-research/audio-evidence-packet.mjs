import { createHash } from 'node:crypto';

const REQUIRED_LAYERS = ['activation','runtime','renderTimeline','route','deviceChange','physical'];
const VALID_PHYSICAL = new Set(['heard','not_heard','not_tested']);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

export function digestEvidence(value) {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function assertString(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`);
}

export function composeAudioEvidencePacket(input) {
  if (!input || typeof input !== 'object') throw new TypeError('input must be an object');
  assertString(input.commitSha, 'commitSha');
  assertString(input.deploymentId, 'deploymentId');
  assertString(input.sessionId, 'sessionId');
  if (!/^[0-9a-f]{40}$/i.test(input.commitSha)) throw new TypeError('commitSha must be a 40-character git SHA');

  for (const layer of REQUIRED_LAYERS) {
    if (!input[layer] || typeof input[layer] !== 'object') throw new TypeError(`${layer} evidence is required`);
    if (input[layer].sessionId !== input.sessionId) throw new Error(`${layer} session mismatch`);
    if (input[layer].commitSha && input[layer].commitSha !== input.commitSha) throw new Error(`${layer} commit mismatch`);
    if (input[layer].deploymentId && input[layer].deploymentId !== input.deploymentId) throw new Error(`${layer} deployment mismatch`);
  }

  if (input.activation.trusted !== true) throw new Error('trusted activation not observed');
  if (input.runtime.state !== 'running') throw new Error('AudioContext was not running');
  if (input.renderTimeline.advancing !== true) throw new Error('render timeline did not advance');
  if (!['bound_non_default','default_only','unsupported','unobservable','rejected'].includes(input.route.classification)) {
    throw new Error('unknown route classification');
  }
  if (!['stable','changed','unsupported','unobservable'].includes(input.deviceChange.classification)) {
    throw new Error('unknown device-change classification');
  }
  if (!VALID_PHYSICAL.has(input.physical.outcome)) throw new Error('unknown physical outcome');

  const contradictions = [];
  if (input.physical.outcome === 'not_heard' && input.renderTimeline.advancing) {
    contradictions.push('rendering_observed_but_not_heard');
  }
  if (input.route.classification === 'rejected' && input.renderTimeline.advancing) {
    contradictions.push('route_selection_rejected_but_rendering_observed');
  }
  if (input.deviceChange.classification === 'changed' && input.route.classification === 'bound_non_default' && input.deviceChange.rebound !== true) {
    contradictions.push('device_changed_without_confirmed_rebind');
  }

  let classification = 'incomplete';
  if (contradictions.length) classification = 'contradicted';
  else if (input.physical.outcome === 'heard') classification = 'supported';
  else if (input.physical.outcome === 'not_heard') classification = 'rejected';

  const packet = {
    schemaVersion: 1,
    identity: { commitSha: input.commitSha, deploymentId: input.deploymentId, sessionId: input.sessionId },
    layers: Object.fromEntries(REQUIRED_LAYERS.map((name) => [name, input[name]])),
    classification,
    contradictions,
    claimBoundary: {
      browserRendering: input.renderTimeline.advancing === true,
      routeBinding: input.route.classification === 'bound_non_default',
      physicalAudibility: input.physical.outcome,
      note: 'Browser rendering and route observations do not independently prove physical audibility.'
    }
  };
  return { ...packet, evidenceDigest: digestEvidence(packet) };
}
