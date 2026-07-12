function asPositiveInteger(value) {
  return Number.isInteger(value) && value > 0 ? value : null;
}

function normalizeArtifacts(artifacts) {
  if (!Array.isArray(artifacts)) return [];
  return artifacts.map((artifact) => ({
    id: asPositiveInteger(artifact?.id),
    name: typeof artifact?.name === 'string' ? artifact.name.trim() : '',
    expired: artifact?.expired === true,
    workflow_run_id: asPositiveInteger(artifact?.workflow_run?.id ?? artifact?.workflow_run_id)
  }));
}

export function evaluateArtifactManifest(input, expected = {}) {
  const expectedRunId = asPositiveInteger(expected.run_id);
  const requiredNames = Array.isArray(expected.required_artifacts)
    ? [...new Set(expected.required_artifacts.filter((name) => typeof name === 'string' && name.trim()).map((name) => name.trim()))]
    : [];

  if (!expectedRunId) {
    return { accepted: false, decision: 'invalid_expectation', reason: 'A positive expected run_id is required.' };
  }
  if (requiredNames.length === 0) {
    return { accepted: false, decision: 'invalid_expectation', reason: 'At least one required artifact name is required.' };
  }

  const artifacts = normalizeArtifacts(input?.artifacts);
  if (artifacts.length === 0) {
    return { accepted: false, decision: 'artifact_manifest_missing', reason: 'No workflow artifacts were supplied.' };
  }

  const invalid = artifacts.find((artifact) => !artifact.id || !artifact.name || !artifact.workflow_run_id);
  if (invalid) {
    return { accepted: false, decision: 'artifact_identity_incomplete', reason: 'Every artifact requires an id, name, and workflow run id.' };
  }

  const wrongRun = artifacts.find((artifact) => artifact.workflow_run_id !== expectedRunId);
  if (wrongRun) {
    return { accepted: false, decision: 'artifact_run_mismatch', reason: `Artifact ${wrongRun.name} belongs to workflow run ${wrongRun.workflow_run_id}, not ${expectedRunId}.` };
  }

  const expired = artifacts.find((artifact) => artifact.expired);
  if (expired) {
    return { accepted: false, decision: 'artifact_expired', reason: `Artifact ${expired.name} is expired.` };
  }

  const counts = new Map();
  for (const artifact of artifacts) counts.set(artifact.name, (counts.get(artifact.name) ?? 0) + 1);
  const duplicate = [...counts.entries()].find(([, count]) => count > 1);
  if (duplicate) {
    return { accepted: false, decision: 'artifact_name_ambiguous', reason: `Artifact name ${duplicate[0]} appears more than once.` };
  }

  const missing = requiredNames.filter((name) => !counts.has(name));
  if (missing.length > 0) {
    return { accepted: false, decision: 'required_artifact_missing', reason: `Missing required artifacts: ${missing.join(', ')}.`, missing };
  }

  return {
    accepted: true,
    decision: 'artifact_manifest_verified',
    reason: 'All required artifacts are unexpired, uniquely named, and bound to the expected workflow run.',
    run_id: expectedRunId,
    artifacts: artifacts.map(({ id, name }) => ({ id, name }))
  };
}
