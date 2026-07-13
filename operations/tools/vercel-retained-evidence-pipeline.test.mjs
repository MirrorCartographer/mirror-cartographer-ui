import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRetainedEvidenceDeploymentPipeline } from './vercel-retained-evidence-pipeline.mjs';

const commit = 'a'.repeat(40);
const captured = '2026-07-13T06:45:00.000Z';

function artifacts(overrides = {}) {
  const reconciliation = {
    verified: true,
    commit_sha: commit,
    provider_ceiling_ambiguous: false,
    primary_count: 2,
    independent_count: 2
  };
  const values = {
    primary_raw: JSON.stringify({ runs: [{ id: 1 }, { id: 2 }] }),
    independent_raw: JSON.stringify([[{ id: 1 }, { id: 2 }]]),
    independent_command: 'gh api --paginate --slurp /repos/o/r/actions/runs?head_sha=' + commit,
    reconciliation: JSON.stringify(reconciliation),
    ...overrides
  };
  const methods = {
    primary_raw: 'github-rest-link-pagination',
    independent_raw: 'gh-api-paginate-slurp',
    independent_command: 'retained-command-text',
    reconciliation: 'deterministic-reconciliation'
  };
  return Object.entries(values).map(([role, bytes]) => ({
    role,
    bytes,
    path: `operations/evidence/${role}.json`,
    captured_at: captured,
    method: methods[role]
  }));
}

function deployment(overrides = {}) {
  return {
    commit_sha: commit,
    evaluated_at: '2026-07-13T06:46:00.000Z',
    provider_capacity: 'available',
    operations_only_change: false,
    immutable_identity_available: true,
    deployment_requested: true,
    ...overrides
  };
}

test('builds a manifest from retained bytes and authorizes only the deployment attempt', () => {
  const result = evaluateRetainedEvidenceDeploymentPipeline({ artifacts: artifacts(), deployment: deployment() });
  assert.equal(result.manifest.evidence_complete, true);
  assert.equal(result.reconciliation_verified, true);
  assert.equal(result.decision.decision, 'authorized');
  assert.equal(result.decision.application_build_allowed, true);
  assert.equal(result.deployment_claim_permitted, false);
  assert.equal(result.decision.deployment_claim_permitted, false);
});

test('recomputes digests from bytes rather than accepting caller-supplied digest claims', () => {
  const original = evaluateRetainedEvidenceDeploymentPipeline({ artifacts: artifacts(), deployment: deployment() });
  const changed = evaluateRetainedEvidenceDeploymentPipeline({
    artifacts: artifacts({ primary_raw: JSON.stringify({ runs: [{ id: 9 }] }) }),
    deployment: deployment()
  });
  assert.notEqual(original.retained_artifact_digests.primary_raw, changed.retained_artifact_digests.primary_raw);
  assert.notEqual(original.manifest.manifest_sha256, changed.manifest.manifest_sha256);
});

test('fails closed when reconciliation commit differs', () => {
  const result = evaluateRetainedEvidenceDeploymentPipeline({
    artifacts: artifacts({ reconciliation: JSON.stringify({
      verified: true,
      commit_sha: 'b'.repeat(40),
      provider_ceiling_ambiguous: false
    }) }),
    deployment: deployment()
  });
  assert.equal(result.reconciliation_verified, false);
  assert.equal(result.decision.decision, 'blocked');
  assert.ok(result.decision.blockers.includes('reconciliation_not_reverified'));
});

test('fails closed on provider ceiling ambiguity', () => {
  const result = evaluateRetainedEvidenceDeploymentPipeline({
    artifacts: artifacts({ reconciliation: JSON.stringify({
      verified: true,
      commit_sha: commit,
      provider_ceiling_ambiguous: true
    }) }),
    deployment: deployment()
  });
  assert.equal(result.decision.decision, 'blocked');
  assert.ok(result.decision.blockers.includes('provider_ceiling_ambiguous'));
});

test('operations-only evidence cannot authorize an application deployment', () => {
  const result = evaluateRetainedEvidenceDeploymentPipeline({
    artifacts: artifacts(),
    deployment: deployment({ operations_only_change: true })
  });
  assert.equal(result.decision.decision, 'blocked');
  assert.ok(result.decision.blockers.includes('operations_only_change_must_not_create_application_build'));
});

test('rejects malformed reconciliation bytes', () => {
  assert.throws(() => evaluateRetainedEvidenceDeploymentPipeline({
    artifacts: artifacts({ reconciliation: '{bad' }),
    deployment: deployment()
  }), /reconciliation bytes must contain valid JSON/);
});
