import { assessRetainedEvidenceHandoff } from './vercel-retained-evidence-handoff.mjs';
import { decideVercelDeploymentAttempt } from './vercel-deployment-attempt-decision.mjs';

function assertObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
}

export function decideVercelDeploymentWithRetainedEvidence(input) {
  assertObject(input, 'input');
  assertObject(input.handoff, 'input.handoff');
  assertObject(input.deployment, 'input.deployment');

  const handoff = assessRetainedEvidenceHandoff(input.handoff);
  const deploymentCommit = input.deployment.commit_sha;
  const commitAligned = deploymentCommit === handoff.expected_commit_sha;

  const deployment = decideVercelDeploymentAttempt({
    ...input.deployment,
    exhaustive_workflow_evidence: handoff.exhaustive_workflow_evidence && commitAligned
  });

  const blockers = [...handoff.blockers];
  if (!commitAligned) blockers.push('handoff_deployment_commit_mismatch');
  for (const blocker of deployment.blockers) {
    if (!blockers.includes(blocker)) blockers.push(blocker);
  }

  const authorized = handoff.handoff_status === 'accepted'
    && commitAligned
    && deployment.application_build_allowed === true;

  return Object.freeze({
    schema_version: 1,
    commit_sha: deploymentCommit,
    evaluated_at: deployment.evaluated_at,
    decision: authorized ? 'authorized' : 'blocked',
    application_build_allowed: authorized,
    retained_evidence_status: handoff.handoff_status,
    deployment_claim_permitted: false,
    blockers: Object.freeze(blockers),
    reason: authorized
      ? 'retained_evidence_and_deployment_prerequisites_satisfied'
      : blockers[0]
  });
}
