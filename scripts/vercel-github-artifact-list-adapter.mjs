function asPositiveInteger(value) {
  return Number.isInteger(value) && value > 0 ? value : null;
}

function asTrimmedString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function normalizeGitHubArtifactListResponse(response, expected = {}) {
  const expectedRunId = asPositiveInteger(expected.run_id);
  if (!expectedRunId) {
    return {
      accepted: false,
      decision: 'invalid_expectation',
      reason: 'A positive expected run_id is required.'
    };
  }

  if (!response || typeof response !== 'object' || !Array.isArray(response.artifacts)) {
    return {
      accepted: false,
      decision: 'artifact_list_shape_invalid',
      reason: 'GitHub artifact-list response must contain an artifacts array.'
    };
  }

  if (response.total_count !== undefined && (!Number.isInteger(response.total_count) || response.total_count < 0)) {
    return {
      accepted: false,
      decision: 'artifact_total_count_invalid',
      reason: 'GitHub artifact-list total_count must be a non-negative integer when present.'
    };
  }

  if (Number.isInteger(response.total_count) && response.total_count !== response.artifacts.length) {
    return {
      accepted: false,
      decision: 'artifact_page_incomplete',
      reason: `Artifact response declared ${response.total_count} items but supplied ${response.artifacts.length}; pagination or truncation must be resolved before acceptance.`
    };
  }

  const artifacts = response.artifacts.map((artifact) => ({
    id: asPositiveInteger(artifact?.id),
    name: asTrimmedString(artifact?.name) ?? '',
    expired: artifact?.expired === true,
    workflow_run_id: asPositiveInteger(artifact?.workflow_run?.id ?? artifact?.workflow_run_id)
  }));

  const incomplete = artifacts.find((artifact) => !artifact.id || !artifact.name || !artifact.workflow_run_id);
  if (incomplete) {
    return {
      accepted: false,
      decision: 'artifact_identity_incomplete',
      reason: 'Every GitHub artifact requires a positive id, non-empty name, and positive workflow run id.'
    };
  }

  const wrongRun = artifacts.find((artifact) => artifact.workflow_run_id !== expectedRunId);
  if (wrongRun) {
    return {
      accepted: false,
      decision: 'artifact_run_mismatch',
      reason: `Artifact ${wrongRun.name} belongs to workflow run ${wrongRun.workflow_run_id}, not ${expectedRunId}.`
    };
  }

  return {
    accepted: true,
    decision: 'artifact_list_normalized',
    reason: 'GitHub artifact-list response is complete and bound to the expected workflow run.',
    run_id: expectedRunId,
    artifacts
  };
}
