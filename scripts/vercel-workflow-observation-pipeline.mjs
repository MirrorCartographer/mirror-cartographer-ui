import { classifyWorkflowQueryResult } from './vercel-workflow-query-classifier.mjs';
import { evaluateWorkflowObservation } from './vercel-workflow-observation-gate.mjs';
import { evaluateArtifactManifest } from './vercel-workflow-artifact-manifest-gate.mjs';
import { normalizeGitHubArtifactListResponse } from './vercel-github-artifact-list-adapter.mjs';

export function evaluateWorkflowQueryPipeline(input, expected = {}) {
  const queryDecision = classifyWorkflowQueryResult(input?.query_result, expected);
  if (!queryDecision.observable) {
    return {
      accepted: false,
      stage: 'query',
      decision: queryDecision.decision,
      reason: queryDecision.reason,
      query: queryDecision
    };
  }

  const run = queryDecision.run;
  const runId = run.id ?? run.run_id ?? null;
  let manifestInput = input;
  let artifactListDecision = null;

  if (input?.github_artifact_response !== undefined) {
    artifactListDecision = normalizeGitHubArtifactListResponse(input.github_artifact_response, { run_id: runId });
    if (!artifactListDecision.accepted) {
      return {
        accepted: false,
        stage: 'artifact_list',
        decision: artifactListDecision.decision,
        reason: artifactListDecision.reason,
        query: queryDecision,
        artifact_list: artifactListDecision
      };
    }
    manifestInput = { ...input, artifacts: artifactListDecision.artifacts };
  }

  const manifestDecision = evaluateArtifactManifest(manifestInput, {
    run_id: runId,
    required_artifacts: expected.required_artifacts
  });
  if (!manifestDecision.accepted) {
    return {
      accepted: false,
      stage: 'artifact_manifest',
      decision: manifestDecision.decision,
      reason: manifestDecision.reason,
      query: queryDecision,
      artifact_list: artifactListDecision,
      artifact_manifest: manifestDecision
    };
  }

  const observation = {
    observed_at: input?.observed_at,
    head_sha: run.head_sha,
    workflow_name: run.name ?? run.workflow_name ?? null,
    status: run.status,
    conclusion: run.conclusion,
    run_id: runId,
    run_attempt: run.run_attempt ?? null,
    html_url: run.html_url ?? null,
    artifacts: manifestDecision.artifacts.map(({ name }) => name)
  };

  const observationDecision = evaluateWorkflowObservation(observation, expected);
  if (!observationDecision.accepted) {
    return {
      accepted: false,
      stage: 'observation',
      decision: observationDecision.decision,
      reason: observationDecision.reason,
      query: queryDecision,
      artifact_list: artifactListDecision,
      artifact_manifest: manifestDecision,
      observation: observationDecision
    };
  }

  return {
    accepted: true,
    stage: 'accepted',
    decision: observationDecision.decision,
    reason: observationDecision.reason,
    query: {
      decision: queryDecision.decision,
      reason: queryDecision.reason,
      expected_commit_sha: queryDecision.expected_commit_sha
    },
    artifact_list: artifactListDecision,
    artifact_manifest: manifestDecision,
    observation: observationDecision
  };
}
