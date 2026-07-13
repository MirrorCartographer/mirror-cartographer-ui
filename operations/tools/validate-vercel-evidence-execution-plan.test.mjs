import test from 'node:test';
import assert from 'node:assert/strict';
import { validateVercelEvidenceExecutionPlan } from './validate-vercel-evidence-execution-plan.mjs';

const sha = 'a'.repeat(40);
const command = `gh api --paginate --slurp -H "Accept: application/vnd.github+json" "/repos/MirrorCartographer/mirror-cartographer-ui/actions/runs?head_sha=${sha}&per_page=100"`;

function validPlan(overrides = {}) {
  return {
    commit_sha: sha,
    primary_output: 'operations/evidence/raw/primary.json',
    primary_headers_output: 'operations/evidence/raw/primary.headers.json',
    independent_output: 'operations/evidence/raw/independent.json',
    independent_headers_output: 'operations/evidence/raw/independent.headers.json',
    retained_command_output: 'operations/evidence/raw/command.txt',
    rate_limit_proof_output: 'operations/evidence/derived/rate-limit-proof.json',
    bundle_output: 'operations/evidence/bundles/v-001.json',
    command,
    overwrite: false,
    pending: false,
    deployment_requested: false,
    ...overrides,
  };
}

test('accepts a bounded exact-commit repository-bound no-overwrite plan with canonical retained paths', () => {
  const result = validateVercelEvidenceExecutionPlan(validPlan());
  assert.equal(result.ok, true);
  assert.equal(result.execution_permitted, true);
  assert.equal(result.commitSha, sha);
  assert.equal(result.repository, 'MirrorCartographer/mirror-cartographer-ui');
  assert.equal(result.evidence_class, 'bounded_execution_plan_with_canonical_retained_paths');
  assert.equal(result.outputs.primary_headers, 'operations/evidence/raw/primary.headers.json');
  assert.equal(result.outputs.independent_headers, 'operations/evidence/raw/independent.headers.json');
  assert.equal(result.outputs.rate_limit_proof, 'operations/evidence/derived/rate-limit-proof.json');
  assert.equal(result.retention_contract.raw_response_headers, true);
  assert.equal(result.retention_contract.dual_client_rate_limit_proof, true);
  assert.equal(result.retention_contract.outputs_must_be_canonically_distinct, true);
});

test('normalizes safe output paths before returning the execution plan', () => {
  const result = validateVercelEvidenceExecutionPlan(validPlan({
    primary_output: './operations/evidence/raw/primary.json',
    independent_headers_output: 'operations\\evidence\\raw\\independent.headers.json',
  }));
  assert.equal(result.ok, true);
  assert.equal(result.outputs.primary, 'operations/evidence/raw/primary.json');
  assert.equal(result.outputs.independent_headers, 'operations/evidence/raw/independent.headers.json');
});

test('rejects missing retained response-header or rate-limit proof paths', () => {
  assert.equal(
    validateVercelEvidenceExecutionPlan(validPlan({ primary_headers_output: undefined })).reason,
    'unsafe_or_missing_output_path',
  );
  assert.equal(
    validateVercelEvidenceExecutionPlan(validPlan({ independent_headers_output: '' })).reason,
    'unsafe_or_missing_output_path',
  );
  assert.equal(
    validateVercelEvidenceExecutionPlan(validPlan({ rate_limit_proof_output: null })).reason,
    'unsafe_or_missing_output_path',
  );
});

test('rejects unsafe or exactly duplicate output paths across all retained artifacts', () => {
  assert.equal(
    validateVercelEvidenceExecutionPlan(validPlan({ primary_output: '../primary.json' })).reason,
    'unsafe_or_missing_output_path',
  );
  assert.equal(
    validateVercelEvidenceExecutionPlan(validPlan({ independent_headers_output: 'operations/evidence/raw/primary.headers.json' })).reason,
    'canonical_output_paths_must_be_distinct',
  );
  assert.equal(
    validateVercelEvidenceExecutionPlan(validPlan({ rate_limit_proof_output: 'operations/evidence/bundles/v-001.json' })).reason,
    'canonical_output_paths_must_be_distinct',
  );
});

test('rejects dot-segment and path-separator aliases that resolve to the same retained artifact', () => {
  assert.equal(
    validateVercelEvidenceExecutionPlan(validPlan({
      independent_output: './operations/evidence/raw/primary.json',
    })).reason,
    'canonical_output_paths_must_be_distinct',
  );
  assert.equal(
    validateVercelEvidenceExecutionPlan(validPlan({
      independent_output: 'operations\\evidence\\raw\\primary.json',
    })).reason,
    'canonical_output_paths_must_be_distinct',
  );
});

test('rejects overwrite, pending records, or deployment requests', () => {
  assert.equal(validateVercelEvidenceExecutionPlan(validPlan({ overwrite: true })).reason, 'overwrite_not_permitted');
  assert.equal(validateVercelEvidenceExecutionPlan(validPlan({ pending: true })).reason, 'pending_records_not_permitted');
  assert.equal(
    validateVercelEvidenceExecutionPlan(validPlan({ deployment_requested: true })).reason,
    'deployment_not_permitted_in_evidence_preflight',
  );
});

test('rejects secret-bearing or non-exhaustive command text', () => {
  assert.equal(
    validateVercelEvidenceExecutionPlan(validPlan({ command: `${command} -H "Authorization: Bearer secret"` })).reason,
    'secret_bearing_command_rejected',
  );
  assert.equal(
    validateVercelEvidenceExecutionPlan(validPlan({ command: `gh api "/repos/MirrorCartographer/mirror-cartographer-ui/actions/runs?head_sha=${sha}&per_page=100"` })).reason,
    'non_exhaustive_independent_command',
  );
});

test('rejects shell-control operators and repository endpoint mismatch', () => {
  assert.equal(
    validateVercelEvidenceExecutionPlan(validPlan({ command: `${command} > /tmp/output.json` })).reason,
    'shell_control_operator_rejected',
  );
  assert.equal(
    validateVercelEvidenceExecutionPlan(validPlan({ command: command.replace('MirrorCartographer/mirror-cartographer-ui', 'Other/repository') })).reason,
    'repository_endpoint_mismatch',
  );
});

test('rejects commit mismatch and non-maximal page size', () => {
  assert.equal(
    validateVercelEvidenceExecutionPlan(validPlan({ command: command.replace(sha, 'b'.repeat(40)) })).reason,
    'command_commit_mismatch',
  );
  assert.equal(
    validateVercelEvidenceExecutionPlan(validPlan({ command: command.replace('per_page=100', 'per_page=50') })).reason,
    'non_maximal_page_size',
  );
});
