import test from 'node:test';
import assert from 'node:assert/strict';
import { decideVercelDeploymentAttempt } from './vercel-deployment-attempt-decision.mjs';

const base = {
  commit_sha: 'a'.repeat(40),
  evaluated_at: '2026-07-13T01:17:34-04:00',
  provider_capacity: 'available',
  operations_only_change: false,
  immutable_identity_available: true,
  exhaustive_workflow_evidence: true,
  deployment_requested: true
};

test('authorizes only when every prerequisite is satisfied', () => {
  const result = decideVercelDeploymentAttempt(base);
  assert.equal(result.decision, 'authorized');
  assert.equal(result.application_build_allowed, true);
  assert.deepEqual(result.blockers, []);
});

test('blocks operations-only changes from creating application builds', () => {
  const result = decideVercelDeploymentAttempt({ ...base, operations_only_change: true });
  assert.equal(result.decision, 'blocked');
  assert.equal(result.application_build_allowed, false);
  assert.ok(result.blockers.includes('operations_only_change_must_not_create_application_build'));
});

test('fails closed when provider capacity is exhausted or unknown', () => {
  for (const provider_capacity of ['exhausted', 'unknown']) {
    const result = decideVercelDeploymentAttempt({ ...base, provider_capacity });
    assert.equal(result.decision, 'blocked');
    assert.ok(result.blockers.includes(`provider_capacity_${provider_capacity}`));
  }
});

test('requires exhaustive workflow evidence and immutable identity', () => {
  const result = decideVercelDeploymentAttempt({
    ...base,
    exhaustive_workflow_evidence: false,
    immutable_identity_available: false
  });
  assert.equal(result.decision, 'blocked');
  assert.deepEqual(result.blockers, [
    'exhaustive_workflow_evidence_missing',
    'immutable_deployment_identity_unavailable'
  ]);
});

test('rejects malformed input rather than guessing', () => {
  assert.throws(() => decideVercelDeploymentAttempt({ ...base, commit_sha: 'short' }));
  assert.throws(() => decideVercelDeploymentAttempt({ ...base, provider_capacity: 'maybe' }));
  assert.throws(() => decideVercelDeploymentAttempt({ ...base, deployment_requested: 'yes' }));
});
