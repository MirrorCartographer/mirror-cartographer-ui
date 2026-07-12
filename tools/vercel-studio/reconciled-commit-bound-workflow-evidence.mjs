import { reconcileWorkflowEnumerations } from '../frontier-research/workflow-run-enumeration-reconciler.mjs';
import { buildCommitBoundWorkflowEvidence } from './commit-bound-workflow-evidence.mjs';

function rejected(commitSha, reason, reconciliation = null) {
  return {
    schema_version: 1,
    commit_sha: commitSha,
    exhaustive: false,
    matching_runs: [],
    errors: [reason],
    finding: 'invalid_observation',
    evidence_strength: 'rejected',
    reconciliation
  };
}

export function buildReconciledCommitBoundWorkflowEvidence({ commitSha, primary, independent, providerCeilingAmbiguous = false }) {
  if (!/^[0-9a-f]{40}$/i.test(commitSha || '')) return rejected(commitSha, 'invalid_commit_sha');
  if (providerCeilingAmbiguous === true) return rejected(commitSha, 'provider_ceiling_ambiguous');

  let reconciliation;
  try {
    reconciliation = reconcileWorkflowEnumerations({ primary, independent, commitSha });
  } catch (error) {
    return rejected(commitSha, `reconciliation_error:${error.message}`);
  }
  if (reconciliation.verified !== true) {
    return rejected(commitSha, `reconciliation_failed:${reconciliation.reason}`, reconciliation);
  }

  const evidence = buildCommitBoundWorkflowEvidence({ commitSha, enumeration: primary });
  if (evidence.evidence_strength !== 'strong' || evidence.exhaustive !== true) {
    return { ...evidence, reconciliation };
  }

  return {
    ...evidence,
    reconciliation,
    independent_enumeration: {
      complete: true,
      reason: independent.reason,
      pages_fetched: independent.pagesFetched,
      run_count: independent.runs.length
    }
  };
}
