const METHODS = ['primary', 'independent'];
const MAX_POLICY_WINDOW_MS = 60 * 60 * 1000;

function fail(reason, details = {}) {
  return { verified: false, reason, ...details };
}

function timestamp(value, field) {
  if (typeof value !== 'string' || value.length === 0) return { error: fail('timestamp_missing', { field }) };
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return { error: fail('timestamp_invalid', { field }) };
  return { ms };
}

function policyWindow(value, field) {
  if (!Number.isInteger(value) || value <= 0 || value > MAX_POLICY_WINDOW_MS) {
    return { error: fail('policy_window_invalid', { field, maximum_ms: MAX_POLICY_WINDOW_MS }) };
  }
  return { ms: value };
}

export function validateEvidenceObservationWindow(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return fail('evidence_invalid');

  const skewPolicy = policyWindow(input.policy?.max_execution_completion_skew_ms, 'policy.max_execution_completion_skew_ms');
  if (skewPolicy.error) return skewPolicy.error;
  const stabilizationPolicy = policyWindow(input.policy?.max_stabilization_gap_ms, 'policy.max_stabilization_gap_ms');
  if (stabilizationPolicy.error) return stabilizationPolicy.error;

  const completions = {};
  for (const method of METHODS) {
    const parsed = timestamp(input[method]?.execution?.completed_at, `${method}.execution.completed_at`);
    if (parsed.error) return { ...parsed.error, method };
    completions[method] = parsed;
  }

  const first = timestamp(input.stabilization?.first_snapshot_at, 'stabilization.first_snapshot_at');
  if (first.error) return first.error;
  const second = timestamp(input.stabilization?.second_snapshot_at, 'stabilization.second_snapshot_at');
  if (second.error) return second.error;

  const completionValues = METHODS.map((method) => completions[method].ms);
  const earliestCompletion = Math.min(...completionValues);
  const latestCompletion = Math.max(...completionValues);
  const executionCompletionSkewMs = latestCompletion - earliestCompletion;

  if (executionCompletionSkewMs > skewPolicy.ms) {
    return fail('execution_completion_skew_exceeded', {
      observed_ms: executionCompletionSkewMs,
      allowed_ms: skewPolicy.ms
    });
  }
  if (first.ms < latestCompletion) {
    return fail('stabilization_started_before_all_executions_completed', {
      latest_execution_completed_at: new Date(latestCompletion).toISOString(),
      first_snapshot_at: input.stabilization.first_snapshot_at
    });
  }
  if (second.ms < first.ms) return fail('snapshot_interval_inverted');

  const stabilizationGapMs = second.ms - first.ms;
  if (stabilizationGapMs > stabilizationPolicy.ms) {
    return fail('stabilization_gap_exceeded', {
      observed_ms: stabilizationGapMs,
      allowed_ms: stabilizationPolicy.ms
    });
  }

  return {
    verified: true,
    reason: 'evidence_observation_window_verified',
    execution_completion_skew_ms: executionCompletionSkewMs,
    stabilization_gap_ms: stabilizationGapMs,
    claim_boundary: {
      proves_ordered_observation_window: true,
      proves_clock_authenticity: false,
      proves_repository_quiescence: false,
      proves_provider_consistency: false
    }
  };
}
