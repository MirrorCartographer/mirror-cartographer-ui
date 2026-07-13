import path from 'node:path';

const SHA_RE = /^[0-9a-f]{40}$/;
const FORBIDDEN_SECRET_RE = /(authorization:|bearer\s+[a-z0-9._-]+|ghp_[a-z0-9]+|github_token|api[_-]?token|access[_-]?token)/i;
const FORBIDDEN_SHELL_CONTROL_RE = /(?:^|\s)(?:&&|\|\||;|\||>|>>|<|`|\$\()/;
const EXPECTED_REPOSITORY = 'MirrorCartographer/mirror-cartographer-ui';
const OUTPUT_ROUTE_CONTRACT = [
  { role: 'primary', prefix: 'operations/evidence/raw/', suffix: '.json', token: 'primary' },
  { role: 'primary_headers', prefix: 'operations/evidence/raw/', suffix: '.headers.json', token: 'primary-headers' },
  { role: 'independent', prefix: 'operations/evidence/raw/', suffix: '.json', token: 'independent' },
  { role: 'independent_headers', prefix: 'operations/evidence/raw/', suffix: '.headers.json', token: 'independent-headers' },
  { role: 'retained_command', prefix: 'operations/evidence/raw/', suffix: '.txt', token: 'command' },
  { role: 'rate_limit_proof', prefix: 'operations/evidence/derived/', suffix: '.json', token: 'rate-limit-proof' },
  { role: 'bundle', prefix: 'operations/evidence/bundles/', suffix: '.json', token: 'bundle' },
];

function fail(reason, extra = {}) {
  return {
    ok: false,
    reason,
    execution_permitted: false,
    evidence_class: 'preflight_rejected',
    ...extra,
  };
}

function canonicalRelativeFile(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  if (path.isAbsolute(value)) return null;
  const normalized = path.posix.normalize(value.replaceAll('\\', '/'));
  if (normalized === '.' || normalized.endsWith('/')) return null;
  if (normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) return null;
  return normalized;
}

function validateOutputRoutes(outputs) {
  for (let index = 0; index < OUTPUT_ROUTE_CONTRACT.length; index += 1) {
    const contract = OUTPUT_ROUTE_CONTRACT[index];
    const output = outputs[index];
    if (!output.startsWith(contract.prefix) || !output.endsWith(contract.suffix)) {
      return {
        ok: false,
        role: contract.role,
        output,
        expectedPrefix: contract.prefix,
        expectedSuffix: contract.suffix,
      };
    }
  }
  return { ok: true };
}

function validateOutputIdentity(outputs, commitSha) {
  for (let index = 0; index < OUTPUT_ROUTE_CONTRACT.length; index += 1) {
    const contract = OUTPUT_ROUTE_CONTRACT[index];
    const output = outputs[index];
    const basename = path.posix.basename(output);
    if (!basename.includes(commitSha)) {
      return {
        ok: false,
        role: contract.role,
        output,
        requiredCommitSha: commitSha,
      };
    }
    if (!basename.includes(contract.token)) {
      return {
        ok: false,
        role: contract.role,
        output,
        requiredRoleToken: contract.token,
      };
    }
  }
  return { ok: true };
}

function hasExpectedRepositoryEndpoint(command) {
  const endpoint = `/repos/${EXPECTED_REPOSITORY}/actions/runs`;
  return command.includes(endpoint);
}

/**
 * Validate an execution plan for the authenticated dual-client Vercel evidence run.
 * This does not execute GitHub or Vercel operations. It only proves that the plan is
 * bounded, non-secret-bearing, no-overwrite, repository-bound, exact-commit scoped,
 * and retains the raw response-header material required by the final evidence bundle.
 */
export function validateVercelEvidenceExecutionPlan(plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    return fail('invalid_plan');
  }

  const {
    commit_sha: commitSha,
    primary_output: primaryOutput,
    primary_headers_output: primaryHeadersOutput,
    independent_output: independentOutput,
    independent_headers_output: independentHeadersOutput,
    retained_command_output: retainedCommandOutput,
    rate_limit_proof_output: rateLimitProofOutput,
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

  const outputs = [
    primaryOutput,
    primaryHeadersOutput,
    independentOutput,
    independentHeadersOutput,
    retainedCommandOutput,
    rateLimitProofOutput,
    bundleOutput,
  ];
  const canonicalOutputs = outputs.map(canonicalRelativeFile);
  if (canonicalOutputs.some((value) => value === null)) {
    return fail('unsafe_or_missing_output_path', { commitSha });
  }
  if (new Set(canonicalOutputs).size !== canonicalOutputs.length) {
    return fail('canonical_output_paths_must_be_distinct', { commitSha });
  }
  const routeValidation = validateOutputRoutes(canonicalOutputs);
  if (!routeValidation.ok) {
    return fail('output_route_contract_mismatch', { commitSha, ...routeValidation });
  }
  const identityValidation = validateOutputIdentity(canonicalOutputs, commitSha);
  if (!identityValidation.ok) {
    return fail('output_identity_contract_mismatch', { commitSha, ...identityValidation });
  }

  if (typeof command !== 'string' || command.trim() === '') {
    return fail('missing_retained_command', { commitSha });
  }
  if (FORBIDDEN_SECRET_RE.test(command)) {
    return fail('secret_bearing_command_rejected', { commitSha });
  }
  if (FORBIDDEN_SHELL_CONTROL_RE.test(command)) {
    return fail('shell_control_operator_rejected', { commitSha });
  }
  if (!command.includes('gh api') || !command.includes('--paginate') || !command.includes('--slurp')) {
    return fail('non_exhaustive_independent_command', { commitSha });
  }
  if (!hasExpectedRepositoryEndpoint(command)) {
    return fail('repository_endpoint_mismatch', { commitSha, expectedRepository: EXPECTED_REPOSITORY });
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
    evidence_class: 'bounded_execution_plan_with_commit_bound_typed_paths',
    commitSha,
    repository: EXPECTED_REPOSITORY,
    outputs: {
      primary: canonicalOutputs[0],
      primary_headers: canonicalOutputs[1],
      independent: canonicalOutputs[2],
      independent_headers: canonicalOutputs[3],
      retained_command: canonicalOutputs[4],
      rate_limit_proof: canonicalOutputs[5],
      bundle: canonicalOutputs[6],
    },
    retention_contract: {
      raw_enumerations: true,
      raw_response_headers: true,
      retained_command: true,
      dual_client_rate_limit_proof: true,
      final_bundle: true,
      outputs_must_be_canonically_distinct: true,
      outputs_must_follow_role_routes: true,
      output_names_must_bind_commit_and_role: true,
      overwrite_forbidden: true,
    },
    claim_boundary: [
      'Proves only that the retained-evidence execution plan is exact-commit scoped, repository-bound, bounded, no-overwrite, and reserves canonically distinct, role-routed, commit-bound paths for raw evidence, derived proof, retained command text, and the final bundle.',
      'Does not prove authentication, workflow-run completeness, response-header authenticity, rate-limit proof acceptance, dual-client agreement, deployment identity, browser behavior, audio audibility, or physical-device observation.',
    ],
  };
}
