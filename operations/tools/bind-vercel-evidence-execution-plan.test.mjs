import test from 'node:test';
import assert from 'node:assert/strict';
import { bindVercelEvidenceExecutionPlan } from './bind-vercel-evidence-execution-plan.mjs';

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

test('creates a deterministic binding for the canonical validated plan', () => {
  const first = bindVercelEvidenceExecutionPlan(validPlan());
  const second = bindVercelEvidenceExecutionPlan(validPlan());
  assert.equal(first.ok, true);
  assert.equal(first.plan_binding_created, true);
  assert.match(first.plan_binding.digest, /^[0-9a-f]{64}$/);
  assert.equal(first.plan_binding.digest, second.plan_binding.digest);
  assert.equal(first.canonical_plan.commit_sha, sha);
});

test('safe path aliases normalize to the same binding', () => {
  const canonical = bindVercelEvidenceExecutionPlan(validPlan());
  const aliased = bindVercelEvidenceExecutionPlan(validPlan({
    primary_output: `./operations/evidence/raw/${sha}-primary.json`,
    independent_headers_output: `operations\\evidence\\raw\\${sha}-independent-headers.headers.json`,
  }));
  assert.equal(aliased.ok, true);
  assert.equal(aliased.plan_binding.digest, canonical.plan_binding.digest);
});

test('a changed exact-commit command produces a different binding', () => {
  const first = bindVercelEvidenceExecutionPlan(validPlan());
  const changed = bindVercelEvidenceExecutionPlan(validPlan({
    command: command.replace('-H "Accept: application/vnd.github+json" ', ''),
  }));
  assert.equal(changed.ok, true);
  assert.notEqual(changed.plan_binding.digest, first.plan_binding.digest);
});

test('invalid plans fail closed and do not receive a binding', () => {
  const result = bindVercelEvidenceExecutionPlan(validPlan({ overwrite: true }));
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'overwrite_not_permitted');
  assert.equal(result.plan_binding_created, false);
  assert.equal(result.plan_binding, undefined);
});
