import { reconcileWorkflowEnumerations } from './workflow-run-enumeration-reconciler.mjs';
import { assessWorkflowEnumerationStability } from './workflow-enumeration-stability.mjs';

export function assessWorkflowEnumerationPromotion(input) {
  if (!input || input.schema_version !== 1) throw new Error('schema_version_unsupported');
  const commitSha = String(input.commit_sha ?? '').toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(commitSha)) throw new Error('commit_sha_invalid');
  if (!Array.isArray(input.observations) || input.observations.length < 2) throw new Error('two_observations_required');

  const reconciliations = [];
  const stabilityObservations = [];
  for (const [index, observation] of input.observations.entries()) {
    const reconciliation = reconcileWorkflowEnumerations({
      primary: observation.primary,
      independent: observation.independent,
      commitSha
    });
    reconciliations.push(reconciliation);
    if (!reconciliation.verified) {
      return {
        schema_version: 1,
        commit_sha: commitSha,
        promotable: false,
        evidence_strength: 'unreconciled_exact_commit_enumeration',
        reason: `observation_${index}_reconciliation_failed`,
        reconciliation,
        falsification_route: 'Repeat both exhaustive clients for the failed observation and require exact agreement before temporal stability assessment.'
      };
    }
    stabilityObservations.push({
      started_at: observation.started_at,
      completed_at: observation.completed_at,
      complete: true,
      provider_ceiling_ambiguous: observation.primary.provider_ceiling_ambiguous === true || observation.independent.provider_ceiling_ambiguous === true,
      runs: observation.primary.runs ?? []
    });
  }

  const stability = assessWorkflowEnumerationStability({
    schema_version: 1,
    commit_sha: commitSha,
    minimum_quiet_period_ms: input.minimum_quiet_period_ms,
    observations: stabilityObservations
  });

  return {
    schema_version: 1,
    commit_sha: commitSha,
    promotable: stability.stable,
    evidence_strength: stability.stable ? 'independently_reconciled_temporally_stabilized_exact_commit_enumeration' : stability.evidence_strength,
    reconciliation_count: reconciliations.length,
    reconciliations,
    stability,
    reason: stability.stable ? 'reconciled_observations_temporally_stable' : 'temporal_stability_failed',
    falsification_route: stability.falsification_route
  };
}
