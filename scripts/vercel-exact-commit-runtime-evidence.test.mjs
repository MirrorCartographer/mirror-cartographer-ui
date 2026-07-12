import test from 'node:test';
import assert from 'node:assert/strict';

const OUTCOMES = [
  'audible_verified',
  'signal_detected_not_audible',
  'route_changed',
  'permission_blocked',
  'unsupported',
  'inconclusive'
];
const SHA = /^[0-9a-f]{40}$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const isUri = (value) => {
  try {
    return typeof value === 'string' && Boolean(new URL(value));
  } catch {
    return false;
  }
};

export function validateEvidence(evidence) {
  const errors = [];
  const require = (condition, path) => {
    if (!condition) errors.push(path);
  };

  require(evidence?.schema_version === 1, 'schema_version');
  require(evidence?.queue_item === 'V-001', 'queue_item');
  require(evidence?.repository === 'MirrorCartographer/mirror-cartographer-ui', 'repository');
  require(SHA.test(evidence?.commit_sha ?? ''), 'commit_sha');
  require(['github_actions', 'trusted_local_runner', 'other_trusted_ci'].includes(evidence?.run_identity?.provider), 'run_identity.provider');
  require(Boolean(evidence?.run_identity?.run_id), 'run_identity.run_id');
  require(isUri(evidence?.run_identity?.immutable_url), 'run_identity.immutable_url');
  require(SHA.test(evidence?.source_checkout?.observed_sha ?? ''), 'source_checkout.observed_sha');
  require(typeof evidence?.source_checkout?.dirty === 'boolean', 'source_checkout.dirty');
  require(typeof evidence?.source_checkout?.match === 'boolean', 'source_checkout.match');
  require(Boolean(evidence?.test_execution?.command), 'test_execution.command');
  require(Number.isInteger(evidence?.test_execution?.exit_code), 'test_execution.exit_code');
  require(DIGEST.test(evidence?.test_execution?.artifact_digest ?? ''), 'test_execution.artifact_digest');
  require(isUri(evidence?.test_execution?.artifact_url), 'test_execution.artifact_url');
  require(JSON.stringify(evidence?.audio_outcomes?.expected_set) === JSON.stringify(OUTCOMES), 'audio_outcomes.expected_set');
  require(
    Array.isArray(evidence?.audio_outcomes?.observed_set)
      && new Set(evidence.audio_outcomes.observed_set).size === evidence.audio_outcomes.observed_set.length
      && evidence.audio_outcomes.observed_set.every((outcome) => OUTCOMES.includes(outcome)),
    'audio_outcomes.observed_set'
  );
  require(typeof evidence?.audio_outcomes?.complete === 'boolean', 'audio_outcomes.complete');

  const classifications = [
    'runtime_verified_only',
    'deployment_verified',
    'device_verified',
    'fully_verified',
    'blocked',
    'failed',
    'inconclusive'
  ];
  require(classifications.includes(evidence?.classification), 'classification');

  if (evidence?.classification === 'fully_verified') {
    require(evidence.source_checkout.match === true && evidence.source_checkout.dirty === false, 'fully_verified.source_checkout');
    require(evidence.test_execution.exit_code === 0, 'fully_verified.test_execution');
    require(evidence.audio_outcomes.complete === true, 'fully_verified.audio_outcomes');
    require(evidence.deployment_binding?.status === 'successful' && evidence.deployment_binding?.match === true, 'fully_verified.deployment_binding');
    require(evidence.physical_device?.performed === true && evidence.physical_device?.result === 'pass', 'fully_verified.physical_device');
  }

  return errors;
}

const valid = {
  schema_version: 1,
  queue_item: 'V-001',
  repository: 'MirrorCartographer/mirror-cartographer-ui',
  commit_sha: 'a'.repeat(40),
  run_identity: {
    provider: 'github_actions',
    run_id: '42',
    started_at: '2026-07-12T16:30:00Z',
    completed_at: '2026-07-12T16:31:00Z',
    immutable_url: 'https://github.com/MirrorCartographer/mirror-cartographer-ui/actions/runs/42'
  },
  source_checkout: { observed_sha: 'a'.repeat(40), dirty: false, match: true },
  test_execution: {
    command: 'node --test scripts/vercel-exact-commit-runtime-evidence.test.mjs',
    exit_code: 0,
    artifact_digest: `sha256:${'b'.repeat(64)}`,
    artifact_url: 'https://github.com/MirrorCartographer/mirror-cartographer-ui/actions/runs/42/artifacts/7'
  },
  audio_outcomes: { expected_set: OUTCOMES, observed_set: OUTCOMES, complete: true },
  deployment_binding: {
    attempted: true,
    immutable_deployment_url: 'https://mirror-cartographer-ui-abc.vercel.app',
    provider_commit_sha: 'a'.repeat(40),
    match: true,
    status: 'successful'
  },
  physical_device: {
    performed: true,
    platform: 'iOS 18',
    browser: 'Safari',
    result: 'pass',
    evidence_url: 'https://example.test/device-proof'
  },
  classification: 'fully_verified',
  limits: []
};

test('accepts complete exact-commit evidence', () => {
  assert.deepEqual(validateEvidence(valid), []);
});

test('rejects false fully_verified classification', () => {
  const invalid = structuredClone(valid);
  invalid.source_checkout.match = false;
  invalid.test_execution.exit_code = 1;
  invalid.audio_outcomes.complete = false;
  invalid.deployment_binding.status = 'blocked';
  invalid.physical_device.result = 'inconclusive';
  assert.ok(validateEvidence(invalid).length >= 5);
});

test('rejects missing six-outcome set', () => {
  const invalid = structuredClone(valid);
  invalid.audio_outcomes.expected_set = OUTCOMES.slice(0, 5);
  assert.ok(validateEvidence(invalid).includes('audio_outcomes.expected_set'));
});
