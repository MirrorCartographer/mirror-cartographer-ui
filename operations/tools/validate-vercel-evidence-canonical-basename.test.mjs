import test from 'node:test';
import assert from 'node:assert/strict';
import { validateVercelEvidenceExecutionPlan } from './validate-vercel-evidence-execution-plan.mjs';

const sha = 'a'.repeat(40);
const command = `gh api --paginate --slurp -H "Accept: application/vnd.github+json" "/repos/MirrorCartographer/mirror-cartographer-ui/actions/runs?head_sha=${sha}&per_page=100"`;

function validPlan(overrides = {}) {
  return {
    commit_sha: sha,
    primary_output: `operations/evidence/raw/${sha}-primary.json`,
    primary_headers_output: `operations/evidence/raw/${sha}-primary-headers.headers.json`,
    independent_output: `operations/evidence/raw/${sha}-independent.json`,
    independent_headers_output: `operations/evidence/raw/${sha}-independent-headers.headers.json`,
    retained_command_output: `operations/evidence/raw/${sha}-command.txt`,
    rate_limit_proof_output: `operations/evidence/derived/${sha}-rate-limit-proof.json`,
    bundle_output: `operations/evidence/bundles/${sha}-bundle.json`,
    command,
    overwrite: false,
    pending: false,
    deployment_requested: false,
    ...overrides,
  };
}

test('accepts the exact canonical basename for every retained artifact role', () => {
  const result = validateVercelEvidenceExecutionPlan(validPlan());
  assert.equal(result.ok, true);
  assert.equal(result.evidence_class, 'bounded_execution_plan_with_canonical_commit_bound_typed_paths');
  assert.equal(result.retention_contract.output_names_must_match_canonical_commit_role_basename, true);
});

test('rejects a primary filename that borrows the primary-headers token', () => {
  const result = validateVercelEvidenceExecutionPlan(validPlan({
    primary_output: `operations/evidence/raw/${sha}-primary-headers.json`,
  }));
  assert.equal(result.reason, 'output_identity_contract_mismatch');
  assert.equal(result.role, 'primary');
  assert.equal(result.expectedBasename, `${sha}-primary.json`);
});

test('rejects extra prefixes before the exact commit identity', () => {
  const result = validateVercelEvidenceExecutionPlan(validPlan({
    bundle_output: `operations/evidence/bundles/archive-${sha}-bundle.json`,
  }));
  assert.equal(result.reason, 'output_identity_contract_mismatch');
  assert.equal(result.role, 'bundle');
});

test('rejects extra suffixes after the exact role identity', () => {
  const result = validateVercelEvidenceExecutionPlan(validPlan({
    independent_output: `operations/evidence/raw/${sha}-independent-copy.json`,
  }));
  assert.equal(result.reason, 'output_identity_contract_mismatch');
  assert.equal(result.role, 'independent');
});

test('preserves fail-closed deployment and shell-control rejection', () => {
  assert.equal(
    validateVercelEvidenceExecutionPlan(validPlan({ deployment_requested: true })).reason,
    'deployment_not_permitted_in_evidence_preflight',
  );
  assert.equal(
    validateVercelEvidenceExecutionPlan(validPlan({ command: `${command} > output.json` })).reason,
    'shell_control_operator_rejected',
  );
});
