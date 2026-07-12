import { classifyAudioAudibilityEvidence } from '../../tools/frontier-research/audio-audibility-evidence.mjs';
import { verifyAudibilitySessionBinding } from './verify-audibility-session-binding.mjs';

const SHA_40 = /^[0-9a-f]{40}$/;
const REQUIRED_DEVICE_FIELDS = ['platform', 'browser', 'audioRoute', 'volumeState', 'sessionId'];
const VERCEL_HOST = /^(?:[a-z0-9-]+-git-[a-z0-9-]+-[a-z0-9-]+|[a-z0-9-]+-[a-z0-9]{9,})\.vercel\.app$/;

function validIsoTime(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function verifyImmutableVercelUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      VERCEL_HOST.test(url.hostname) &&
      url.username === '' && url.password === '' &&
      url.port === '' && url.pathname === '/' &&
      url.search === '' && url.hash === '';
  } catch {
    return false;
  }
}

export function verifyPhysicalAudibilityEvidence(packet = {}) {
  const runtime = classifyAudioAudibilityEvidence(packet.runtimeEvidence);
  const sessionBinding = verifyAudibilitySessionBinding(packet);
  const failures = [...sessionBinding.failures];

  if (!SHA_40.test(packet.applicationCommit ?? '')) failures.push('invalid_application_commit');
  if (packet.deployment?.sourceCommit !== packet.applicationCommit) failures.push('deployment_commit_mismatch');
  if (packet.testedCommit !== packet.applicationCommit) failures.push('tested_commit_mismatch');
  if (packet.deployment?.immutable !== true) failures.push('deployment_not_immutable');
  if (packet.deployment?.status !== 'ready') failures.push('deployment_not_ready');
  if (!verifyImmutableVercelUrl(packet.deployment?.url)) failures.push('invalid_immutable_vercel_url');
  if (!validIsoTime(packet.deployment?.readyAt)) failures.push('invalid_deployment_ready_time');
  if (!validIsoTime(packet.testedAt)) failures.push('invalid_tested_time');
  if (
    validIsoTime(packet.deployment?.readyAt) &&
    validIsoTime(packet.testedAt) &&
    Date.parse(packet.testedAt) < Date.parse(packet.deployment.readyAt)
  ) {
    failures.push('test_precedes_deployment_ready');
  }

  for (const field of REQUIRED_DEVICE_FIELDS) {
    if (typeof packet.device?.[field] !== 'string' || packet.device[field].trim() === '') failures.push(`missing_device_${field}`);
  }

  if (runtime.state === 'human_confirmed') {
    if (!validIsoTime(packet.humanCheck?.observedAt)) failures.push('invalid_human_observation_time');
    if (validIsoTime(packet.testedAt) && validIsoTime(packet.humanCheck?.observedAt) && Date.parse(packet.humanCheck.observedAt) < Date.parse(packet.testedAt)) {
      failures.push('human_observation_precedes_test');
    }
  }
  if (!runtime.supportsAudibilityClaim) failures.push(`audibility_${runtime.state}`);

  return Object.freeze({
    schemaVersion: '1.3.0',
    status: failures.length === 0 ? 'pass' : 'fail',
    supportsPhysicalAudibilityClaim: failures.length === 0,
    runtime,
    sessionBinding,
    failures: Object.freeze(failures),
  });
}
