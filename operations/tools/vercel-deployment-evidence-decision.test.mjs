import test from 'node:test';
import assert from 'node:assert/strict';
import { decideVercelDeploymentWithRetainedEvidence } from './vercel-deployment-evidence-decision.mjs';

const commit = 'a'.repeat(40);
const manifest = {
  schema_version: 1,
  commit_sha: commit,
  evidence_complete: true,
  deployment_claim_permitted: false,
  manifest_sha256: 'b'.repeat(64),
  capture_window_ms: 1000,
  artifacts: [
    { role: 'primary_raw' },
    { role: 'independent_raw' },
    { role: 'independent_command' },
    { role: 'reconciliation' }
  ]
};
const base = {
  handoff: {
    expected_commit_sha: commit,
    manifest,
    raw_bytes_reverified: true,
    reconciliation_verified: true,
    provider_ceiling_ambiguous: false
  },
  deployment: {
    commit_sha: commit,
    evaluated_at: '2026-07-13T01:33:35-04:00',
    provider_capacity: 'available',
    operations_only_change: false,
    immutable_identity_available: true,
    deployment_requested: true
  }
};

test('authorizes only through an accepted exact-commit handoff', () => {
  const result = decideVercelDeploymentWithRetainedEvidence(base);
  assert.equal(result.decision, 'authorized');
  assert.equal(result.application_build_allowed, true);
  assert.equal(result.deployment_claim_permitted, false);
  assert.deepEqual(result.blockers, []);
});

test('blocks a deployment commit that differs from retained evidence', () => {
  const result = decideVercelDeploymentWithRetainedEvidence({
    ...base,
    deployment: { ...base.deployment, commit_sha: 'c'.repeat(40) }
  });
  assert.equal(result.decision, 'blocked');
  assert.ok(result.blockers.includes('handoff_deployment_commit_mismatch'));
  assert.ok(result.blockers.includes('exhaustive_workflow_evidence_missing'));
});

test('cannot bypass a blocked handoff with a caller-supplied evidence boolean', () => {
  const result = decideVercelDeploymentWithRetainedEvidence({
    handoff: { ...base.handoff, raw_bytes_reverified: false },
    deployment: { ...base.deployment, exhaustive_workflow_evidence: true }
  });
  assert.equal(result.decision, 'blocked');
  assert.ok(result.blockers.includes('retained_raw_bytes_not_reverified'));
  assert.ok(result.blockers.includes('exhaustive_workflow_evidence_missing'));
});

test('retains provider and immutable identity fail-closed blockers', () => {
  const result = decideVercelDeploymentWithRetainedEvidence({
    ...base,
    deployment: {
      ...base.deployment,
      provider_capacity: 'exhausted',
      immutable_identity_available: false
    }
  });
  assert.equal(result.decision, 'blocked');
  assert.ok(result.blockers.includes('provider_capacity_exhausted'));
  assert.ok(result.blockers.includes('immutable_deployment_identity_unavailable'));
});

test('rejects malformed envelopes instead of guessing', () => {
  assert.throws(() => decideVercelDeploymentWithRetainedEvidence(null));
  assert.throws(() => decideVercelDeploymentWithRetainedEvidence({ handoff: {}, deployment: null }));
});
