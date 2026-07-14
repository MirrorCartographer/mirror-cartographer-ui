const METHODS = ['primary', 'independent'];

function fail(reason, details = {}) {
  return { verified: false, reason, ...details };
}

function parseTimestamp(value, field) {
  if (typeof value !== 'string' || value.length === 0) {
    return { error: fail('timestamp_missing', { field }) };
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) {
    return { error: fail('timestamp_invalid', { field }) };
  }
  return { milliseconds };
}

export function validateEvidenceTemporalCoherence(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return fail('evidence_invalid');
  }

  const captured = parseTimestamp(input.captured_at, 'captured_at');
  if (captured.error) return captured.error;

  const executions = {};
  for (const method of METHODS) {
    const execution = input[method]?.execution;
    if (!execution || typeof execution !== 'object' || Array.isArray(execution)) {
      return fail('execution_missing', { method });
    }

    const started = parseTimestamp(execution.started_at, `${method}.execution.started_at`);
    if (started.error) return { ...started.error, method };
    const completed = parseTimestamp(execution.completed_at, `${method}.execution.completed_at`);
    if (completed.error) return { ...completed.error, method };

    if (completed.milliseconds < started.milliseconds) {
      return fail('execution_interval_inverted', { method });
    }
    if (completed.milliseconds > captured.milliseconds) {
      return fail('execution_completed_after_capture', { method });
    }

    executions[method] = {
      started_at: execution.started_at,
      completed_at: execution.completed_at
    };
  }

  const stabilization = input.stabilization;
  if (!stabilization || typeof stabilization !== 'object' || Array.isArray(stabilization)) {
    return fail('stabilization_missing');
  }

  const first = parseTimestamp(stabilization.first_snapshot_at, 'stabilization.first_snapshot_at');
  if (first.error) return first.error;
  const second = parseTimestamp(stabilization.second_snapshot_at, 'stabilization.second_snapshot_at');
  if (second.error) return second.error;

  if (second.milliseconds < first.milliseconds) {
    return fail('snapshot_interval_inverted');
  }
  if (second.milliseconds > captured.milliseconds) {
    return fail('snapshot_completed_after_capture');
  }

  return {
    verified: true,
    reason: 'evidence_temporal_coherence_verified',
    captured_at: input.captured_at,
    executions,
    stabilization: {
      first_snapshot_at: stabilization.first_snapshot_at,
      second_snapshot_at: stabilization.second_snapshot_at
    },
    claim_boundary: {
      proves_timestamp_ordering: true,
      proves_clock_authenticity: false,
      proves_clock_synchronization: false,
      proves_execution_identity: false
    }
  };
}
