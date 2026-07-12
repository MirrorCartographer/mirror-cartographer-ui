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
const REF = /^refs\/(heads|tags)\/.+/;

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
  require(['push', 'workflow_dispatch'].includes(evidence?.trigger_provenance?.event_name), 'trigger_provenance.event_name');
  require(REF.test(evidence?.trigger_provenance?.ref ?? ''), 'trigger_provenance.ref');
  require(Boolean(evidence?.trigger_provenance?.ref_name), 'trigger_provenance.ref_name');
  require(['branch', 'tag'].includes(evidence?.trigger_provenance?.ref_type), 'trigger_provenance.ref_type');
  require(['github_actions', 'trusted_local_runner', 'other_trusted_ci'].includes(evidence?.run_identity?.provider), 'run_identity.provider');
  require(Boolean(evidence?.run_identity?.run_id), 'run_identity.run_id');
  require(Boolean(evidence?.run_identity?.run_attempt), 'run_identity.run_attempt');
  require(isUri(evidence?.run_identity?.immutable_url), 'run_identity.immutable_url');
  require(SHA.test(evidence?.source_checkout?.observed_sha ?? ''), 'source_checkout.observed_sha');
  require(typeof evidence?.source_checkout?.dirty === 'boolean', 'source_checkout.dirty');
  require(typeof evidence?.source_checkout?.match === 'boolean', 'source_checkout.match');
  require(Boolean(evidence?.test_execution?.command), 'test_execution.command');
  require(Number.isInteger(evidence?.test_execution?.exit_code), 'test_execution.exit_code');
  require(DIGEST.test(evidence?.test_execution?.artifact_digest ?? ''), 'test_execution.artifact_digest');
  require(isUri(evidence?.test_execution?.artifact_url), 'test_execution.artifact_url');
  require(Boolean(evidence?.test_execution?.artifact_name), 'test_execution.artifact_name');
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

export const evidenceOutcomes = Object.freeze([...OUTCOMES]);
