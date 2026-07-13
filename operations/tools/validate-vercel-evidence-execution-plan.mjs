import path from 'node:path';

const SHA_RE = /^[0-9a-f]{40}$/;
const FORBIDDEN_SECRET_RE = /(authorization:|bearer\s+[a-z0-9._-]+|ghp_[a-z0-9]+|github_token|api[_-]?token|access[_-]?token)/i;

function fail(reason, extra = {}) {
  return {
    ok: false,
    reason,
    execution_permitted: false,
    evidence_class: 'preflight_rejected',
    ...extra,
  };
}

function isSafeRelativeFile(value) {
  if (typeof value !== 'string' || value.trim() === '') return false;
  if (path.isAbsolute(value)) return false;
  const normalized = path.posix.normalize(value.replaceAll('\\', '/'));
  return normalized !== '..' && !normalized.startsWith('../') && !normalized.includes('/../');
}

function unique(values) {
  return new Set(values).size === values.length;
}

/**
 * Validate an execution plan for the authenticated dual-client Vercel evidence run.
 * This does not execute GitHub or Vercel operations. It only proves that the plan is
 * bounded, non-secret-bearing, no-overwrite, and exact-commit scoped.
 */
export function validateVercelEvidenceExecutionPlan(plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    return fail('invalid_plan');
  }

  const {
    commit_sha: commitSha,
    primary_output: primaryOutput,
    independent_output: independentOutput,
    retained_command_output: retainedCommandOutput,
    bundle_output: bundleOutput,
    command,
    overwrite = false,
    pending = false,
    deployment_requested: deploymentRequested = false,
  } = plan;

  if (!SHA_RE.test(commitSha ?? '')) return fail('invalid_commit_sha');
  if (pending) return fail('pending_records_not_permitted', { commitSha });
  if (overwrite) return fail('overwrite_not_permitted', { commitSha });
  if (deploymentRequested) return fail('deployment_not_permitted_in_evidence_preflight', { commitSha });

  const outputs = [primaryOutput, independentOutput, retainedCommandOutput, bundleOutput];
  if (!outputs.every(isSafeRelativeFile)) {
    return fail('unsafe_or_missing_output_path', { commitSha });
  }
  if (!unique(outputs)) return fail('output_paths_must_be_distinct', { commitSha });

  if (typeof command !== 'string' || command.trim() === '') {
    return fail('missing_retained_command', { commitSha });
  }
  if (FORBIDDEN_SECRET_RE.test(command)) {
    return fail('secret_bearing_command_rejected', { commitSha });
  }
  if (!command.includes('gh api') || !command.includes('--paginate') || !command.includes('--slurp')) {
    return fail('non_exhaustive_independent_command', { commitSha });
  }
  if (!command.includes(`head_sha=${commitSha}`)) {
    return fail('command_commit_mismatch', { commitSha });
  }
  if (!command.includes('per_page=100')) {
    return fail('non_maximal_page_size', { commitSha });
  }

  return {
    ok: true,
    reason: 'execution_plan_ready',
    execution_permitted: true,
    evidence_class: 'bounded_execution_plan',
    commitSha,
    outputs: {
      primary: primaryOutput,
      independent: independentOutput,
      retained_command: retainedCommandOutput,
      bundle: bundleOutput,
    },
    claim_boundary: [
      'Proves only that the retained-evidence execution plan is exact-commit scoped, bounded, no-overwrite, and free of obvious secret-bearing command text.',
      'Does not prove authentication, workflow-run completeness, dual-client agreement, deployment identity, browser behavior, audio audibility, or physical-device observation.',
    ],
  };
}
