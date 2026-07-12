export const STATES = Object.freeze({
  WAIT: 'operations_only_wait',
  SENTINEL: 'run_operations_only_sentinel',
  AUDIO: 'run_exact_commit_audio_verification',
  DEPLOY: 'bind_immutable_deployment',
  DEVICE: 'run_physical_iphone_safari_check',
  COMPLETE: 'acceptance_complete'
});

const yes = value => value === true || value === 'observed_pass';

export function sequenceVercelAcceptance(input = {}) {
  const capacity = input.provider_capacity;
  if (capacity !== 'available') {
    return decision(STATES.WAIT, 'provider_capacity_not_observed_available', false);
  }
  if (!yes(input.operations_only_sentinel_skipped)) {
    return decision(STATES.SENTINEL, 'ignore_command_suppression_not_observed', true);
  }
  if (!yes(input.exact_commit_audio_artifact_passed)) {
    return decision(STATES.AUDIO, 'exact_commit_audio_evidence_missing', true);
  }
  if (!yes(input.immutable_deployment_bound)) {
    return decision(STATES.DEPLOY, 'immutable_successful_deployment_missing', true);
  }
  if (!yes(input.physical_iphone_safari_audible)) {
    return decision(STATES.DEVICE, 'physical_device_audibility_missing', false);
  }
  return decision(STATES.COMPLETE, 'all_v001_acceptance_evidence_observed', false);
}

function decision(next_action, reason, consumes_provider_build) {
  return Object.freeze({
    schema_version: 1,
    queue_item: 'V-001',
    next_action,
    reason,
    consumes_provider_build,
    fail_closed: next_action !== STATES.COMPLETE
  });
}
