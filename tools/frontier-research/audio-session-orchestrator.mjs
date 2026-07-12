import { sampleAndEvaluateAudioClock } from './audio-clock-sampler.mjs';
import { evaluateAudioClockEvidence } from './audio-clock-evidence.mjs';
import { composeAudioEvidencePacket } from './audio-evidence-packet.mjs';

function assertIdentity(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`);
}

function bindLayer(layer, identity, name) {
  if (!layer || typeof layer !== 'object') throw new TypeError(`${name} evidence is required`);
  for (const key of ['sessionId', 'commitSha', 'deploymentId']) {
    if (layer[key] !== undefined && layer[key] !== identity[key]) {
      throw new Error(`${name} ${key} mismatch`);
    }
  }
  return { ...layer, ...identity };
}

export async function runAudioEvidenceSession(input, dependencies = {}) {
  if (!input || typeof input !== 'object') throw new TypeError('input must be an object');
  assertIdentity(input.sessionId, 'sessionId');
  assertIdentity(input.commitSha, 'commitSha');
  assertIdentity(input.deploymentId, 'deploymentId');
  if (!/^[0-9a-f]{40}$/i.test(input.commitSha)) throw new TypeError('commitSha must be a 40-character git SHA');
  if (!input.context || typeof input.context !== 'object') throw new TypeError('context must be an object');

  const identity = {
    sessionId: input.sessionId,
    commitSha: input.commitSha,
    deploymentId: input.deploymentId
  };

  const clock = await sampleAndEvaluateAudioClock(
    input.context,
    dependencies.evaluateAudioClock ?? evaluateAudioClockEvidence,
    dependencies.samplerOptions ?? input.samplerOptions ?? {}
  );

  const rawCapture = { ...clock.captured, ...identity };
  const clockEvaluation = clock.evaluation ? { ...clock.evaluation, ...identity } : null;

  if (!clock.forwarded) {
    return {
      schemaVersion: 1,
      identity,
      status: 'incomplete',
      reason: clock.reason,
      rawCapture,
      clockEvaluation,
      packet: null,
      claimBoundary: 'Clock evidence must be observed and consistent before composition; no physical audibility claim is made.'
    };
  }

  const packet = (dependencies.composePacket ?? composeAudioEvidencePacket)({
    ...identity,
    activation: bindLayer(input.activation, identity, 'activation'),
    runtime: bindLayer(input.runtime, identity, 'runtime'),
    renderTimeline: bindLayer(input.renderTimeline, identity, 'renderTimeline'),
    route: bindLayer(input.route, identity, 'route'),
    deviceChange: bindLayer(input.deviceChange, identity, 'deviceChange'),
    physical: bindLayer(input.physical, identity, 'physical')
  });

  return {
    schemaVersion: 1,
    identity,
    status: 'composed',
    reason: null,
    rawCapture,
    clockEvaluation,
    packet,
    claimBoundary: 'A composed browser evidence packet remains conditional on its physical outcome and does not infer audibility from clock consistency.'
  };
}
