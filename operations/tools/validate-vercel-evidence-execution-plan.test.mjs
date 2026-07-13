import test from 'node:test';
import assert from 'node:assert/strict';
import { validateVercelEvidenceExecutionPlan } from './validate-vercel-evidence-execution-plan.mjs';

const sha = 'a'.repeat(40);
const command = `gh api --paginate --slurp -H "Accept: application/vnd.github+json" "/repos/MirrorCartographer/mirror-cartographer-ui/actions/runs?head_sha=${sha}&per_page=100"`;

function validPlan(overrides = {}) {
  return {
    commit_sha: sha,
    primary_output: 'operations/evidence/raw/primary.json',
    independent_output: 'operations/evidence/raw/independent.json',
    retained_command_output: 'operations/evidence/raw/command.txt',
    bundle_output: 'operations/evidence/bundles/v-001.json',
    command,
    overwrite: false,
    pending: false,
    deployment_requested: false,
    ...overrides,
  };
}

test('accepts a bounded exact-commit no-overwrite plan', () => {
  const result = validateVercelEvidenceExecutionPlan(validPlan());
  assert.equal(result.ok, true);
  assert.equal(result.execution_permitted, true);
  assert.equal(result.commitSha, sha);
});

test('rejects unsafe or duplicate output paths', () => {
  assert.equal(
    validateVercelEvidenceExecutionPlan(validPlan({ primary_output: '../primary.json' })).reason,
    'unsafe_or_missing_output_path',
  );
  assert.equal(
    validateVercelEvidenceExecutionPlan(validPlan({ independent_output: 'operations/evidence/raw/primary.json' })).reason,
    'output_paths_must_be_distinct',
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
    validateVercelEvidenceExecutionPlan(validPlan({ command: `gh api "/actions/runs?head_sha=${sha}&per_page=100"` })).reason,
    'non_exhaustive_independent_command',
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
