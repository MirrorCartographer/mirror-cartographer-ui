import { classifyAudioAudibilityEvidence } from '../../tools/frontier-research/audio-audibility-evidence.mjs';
import { verifyAudibilitySessionBinding } from './verify-audibility-session-binding.mjs';

const SHA_40 = /^[0-9a-f]{40}$/;
const REQUIRED_DEVICE_FIELDS = ['platform', 'browser', 'audioRoute', 'volumeState', 'sessionId'];
const VERCEL_HOST = /^(?:[a-z0-9-]+-git-[a-z0-9-]+-[a-z0-9-]+|[a-z0-9-]+-[a-z0-9]{9,})\.vercel\.app$/;
const MAX_DEPLOYMENT_TO_TEST_MS = 15 * 60 * 1000;
const MAX_TEST_TO_HUMAN_MS = 5 * 60 * 1000;

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
  if (validIsoTime(packet.deployment?.readyAt) && validIsoTime(packet.testedAt)) {
    const deploymentToTestMs = Date.parse(packet.testedAt) - Date.parse(packet.deployment.readyAt);
    if (deploymentToTestMs < 0) failures.push('test_precedes_deployment_ready');
    if (deploymentToTestMs > MAX_DEPLOYMENT_TO_TEST_MS) failures.push('test_too_stale_after_deployment');
  }

  for (const field of REQUIRED_DEVICE_FIELDS) {
    if (typeof packet.device?.[field] !== 'string' || packet.device[field].trim() === '') failures.push(`missing_device_${field}`);
  }

  if (runtime.state === 'human_confirmed') {
    if (!validIsoTime(packet.humanCheck?.observedAt)) failures.push('invalid_human_observation_time');
    if (validIsoTime(packet.testedAt) && validIsoTime(packet.humanCheck?.observedAt)) {
      const testToHumanMs = Date.parse(packet.humanCheck.observedAt) - Date.parse(packet.testedAt);
      if (testToHumanMs < 0) failures.push('human_observation_precedes_test');
      if (testToHumanMs > MAX_TEST_TO_HUMAN_MS) failures.push('human_observation_too_stale');
    }
  }
  if (!runtime.supportsAudibilityClaim) failures.push(`audibility_${runtime.state}`);

  return Object.freeze({
    schemaVersion: '1.4.0',
    status: failures.length === 0 ? 'pass' : 'fail',
    supportsPhysicalAudibilityClaim: failures.length === 0,
    freshnessPolicy: Object.freeze({
      maxDeploymentToTestMs: MAX_DEPLOYMENT_TO_TEST_MS,
      maxTestToHumanMs: MAX_TEST_TO_HUMAN_MS,
    }),
    runtime,
    sessionBinding,
    failures: Object.freeze(failures),
  });
}
