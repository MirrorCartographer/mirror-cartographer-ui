import { classifyAudioAudibilityEvidence } from '../../tools/frontier-research/audio-audibility-evidence.mjs';

const SHA_40 = /^[0-9a-f]{40}$/;
const REQUIRED_DEVICE_FIELDS = ['platform', 'browser', 'audioRoute', 'volumeState', 'sessionId'];

export function verifyPhysicalAudibilityEvidence(packet = {}) {
  const runtime = classifyAudioAudibilityEvidence(packet.runtimeEvidence);
  const failures = [];

  if (!SHA_40.test(packet.applicationCommit ?? '')) failures.push('invalid_application_commit');
  if (packet.deployment?.sourceCommit !== packet.applicationCommit) failures.push('deployment_commit_mismatch');
  if (packet.testedCommit !== packet.applicationCommit) failures.push('tested_commit_mismatch');
  if (packet.deployment?.immutable !== true) failures.push('deployment_not_immutable');
  if (packet.deployment?.status !== 'ready') failures.push('deployment_not_ready');

  for (const field of REQUIRED_DEVICE_FIELDS) {
    if (typeof packet.device?.[field] !== 'string' || packet.device[field].trim() === '') {
      failures.push(`missing_device_${field}`);
    }
  }

  if (runtime.state === 'human_confirmed' && packet.humanCheck?.observedAt == null) {
    failures.push('missing_human_observation_time');
  }
  if (!runtime.supportsAudibilityClaim) failures.push(`audibility_${runtime.state}`);

  return Object.freeze({
    schemaVersion: '1.0.0',
    status: failures.length === 0 ? 'pass' : 'fail',
    supportsPhysicalAudibilityClaim: failures.length === 0,
    runtime,
    failures: Object.freeze(failures),
  });
}
