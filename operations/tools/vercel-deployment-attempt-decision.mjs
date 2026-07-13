const SHA40 = /^[0-9a-f]{40}$/;

function validIso(value) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

export function decideVercelDeploymentAttempt(input) {
  if (!input || typeof input !== 'object') throw new TypeError('input must be an object');

  const {
    commit_sha,
    evaluated_at,
    provider_capacity,
    operations_only_change,
    immutable_identity_available,
    exhaustive_workflow_evidence,
    deployment_requested
  } = input;

  if (!SHA40.test(commit_sha ?? '')) throw new Error('commit_sha must be 40 lowercase hex characters');
  if (!validIso(evaluated_at)) throw new Error('evaluated_at must be an ISO-8601 timestamp');
  if (!['available', 'exhausted', 'unknown'].includes(provider_capacity)) {
    throw new Error('provider_capacity must be available, exhausted, or unknown');
  }
  for (const [name, value] of Object.entries({
    operations_only_change,
    immutable_identity_available,
    exhaustive_workflow_evidence,
    deployment_requested
  })) {
    if (typeof value !== 'boolean') throw new TypeError(`${name} must be boolean`);
  }

  const blockers = [];
  if (!deployment_requested) blockers.push('deployment_not_requested');
  if (operations_only_change) blockers.push('operations_only_change_must_not_create_application_build');
  if (provider_capacity !== 'available') blockers.push(`provider_capacity_${provider_capacity}`);
  if (!exhaustive_workflow_evidence) blockers.push('exhaustive_workflow_evidence_missing');
  if (!immutable_identity_available) blockers.push('immutable_deployment_identity_unavailable');

  const authorized = blockers.length === 0;
  return {
    schema_version: 1,
    commit_sha,
    evaluated_at,
    decision: authorized ? 'authorized' : 'blocked',
    application_build_allowed: authorized,
    blockers,
    reason: authorized
      ? 'all_fail_closed_deployment_prerequisites_satisfied'
      : blockers[0]
  };
}
