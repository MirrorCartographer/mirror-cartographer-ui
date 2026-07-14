const SHA40 = /^[0-9a-f]{40}$/;
const TOKEN = /^[A-Za-z0-9._:@/-]{1,200}$/;

function fail(reason, details = {}) {
  return { verified: false, reason, ...details };
}

function validTimestamp(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function validateMethod(method, declaration, expectedCommit) {
  if (!declaration || typeof declaration !== 'object') return fail('execution_provenance_missing', { method });

  for (const field of ['client_id', 'client_version', 'invocation_id', 'runner_id']) {
    if (typeof declaration[field] !== 'string' || !TOKEN.test(declaration[field])) {
      return fail('execution_identity_invalid', { method, field });
    }
  }

  if (!SHA40.test(declaration.commit_sha ?? '')) return fail('execution_commit_invalid', { method });
  if (declaration.commit_sha !== expectedCommit) {
    return fail('execution_commit_mismatch', { method, expected: expectedCommit, observed: declaration.commit_sha });
  }

  if (!validTimestamp(declaration.started_at) || !validTimestamp(declaration.completed_at)) {
    return fail('execution_timestamp_invalid', { method });
  }

  const started = Date.parse(declaration.started_at);
  const completed = Date.parse(declaration.completed_at);
  if (completed < started) return fail('execution_time_reversed', { method });

  if (!Array.isArray(declaration.command_argv) || declaration.command_argv.length === 0 ||
      declaration.command_argv.some((arg) => typeof arg !== 'string' || arg.length === 0 || arg.length > 500)) {
    return fail('execution_command_invalid', { method });
  }

  if (declaration.environment_class !== 'authenticated_repository_read') {
    return fail('execution_environment_invalid', { method });
  }

  return {
    verified: true,
    method,
    client_id: declaration.client_id,
    client_version: declaration.client_version,
    invocation_id: declaration.invocation_id,
    runner_id: declaration.runner_id,
    commit_sha: declaration.commit_sha,
    started_at: declaration.started_at,
    completed_at: declaration.completed_at,
    command_argv: [...declaration.command_argv]
  };
}

export function verifyIndependentExecutionProvenance(input) {
  if (!input || typeof input !== 'object') return fail('manifest_invalid');
  if (!SHA40.test(input.commit_sha ?? '')) return fail('manifest_commit_invalid');

  const primary = validateMethod('primary', input.primary?.execution, input.commit_sha);
  if (!primary.verified) return primary;
  const independent = validateMethod('independent', input.independent?.execution, input.commit_sha);
  if (!independent.verified) return independent;

  if (primary.client_id === independent.client_id) {
    return fail('independent_client_reuses_primary_client', { client_id: primary.client_id });
  }
  if (primary.invocation_id === independent.invocation_id) {
    return fail('independent_invocation_reuses_primary_invocation', { invocation_id: primary.invocation_id });
  }
  if (primary.command_argv.join('\u0000') === independent.command_argv.join('\u0000')) {
    return fail('independent_command_reuses_primary_command');
  }

  return {
    verified: true,
    reason: 'independent_execution_provenance_valid',
    commit_sha: input.commit_sha,
    primary,
    independent,
    independence_claim: 'distinct_client_and_invocation_identifiers',
    limits: ['Identifiers are attested input and do not independently prove process isolation or operator independence.']
  };
}
