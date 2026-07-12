import { classifyWorkflowQueryResult } from './vercel-workflow-query-classifier.mjs';
import { evaluateWorkflowObservation } from './vercel-workflow-observation-gate.mjs';

function normalizeArtifactNames(artifacts) {
  if (!Array.isArray(artifacts)) return [];
  return artifacts
    .map((artifact) => typeof artifact === 'string' ? artifact : artifact?.name)
    .filter((name) => typeof name === 'string' && name.length > 0);
}

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
  const artifactNames = normalizeArtifactNames(input?.artifacts);
  const observation = {
    observed_at: input?.observed_at,
    head_sha: run.head_sha,
    workflow_name: run.name ?? run.workflow_name ?? null,
    status: run.status,
    conclusion: run.conclusion,
    run_id: run.id ?? run.run_id ?? null,
    run_attempt: run.run_attempt ?? null,
    html_url: run.html_url ?? null,
    artifacts: artifactNames
  };

  const observationDecision = evaluateWorkflowObservation(observation, expected);
  if (!observationDecision.accepted) {
    return {
      accepted: false,
      stage: 'observation',
      decision: observationDecision.decision,
      reason: observationDecision.reason,
      query: queryDecision,
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
    observation: observationDecision
  };
}
