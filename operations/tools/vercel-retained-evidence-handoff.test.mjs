import test from 'node:test';
import assert from 'node:assert/strict';
import { assessRetainedEvidenceHandoff } from './vercel-retained-evidence-handoff.mjs';

const sha = 'a'.repeat(40);
const digest = 'b'.repeat(64);
const manifest = {
  schema_version: 1,
  commit_sha: sha,
  evidence_complete: true,
  deployment_claim_permitted: false,
  capture_window_ms: 4200,
  manifest_sha256: digest,
  artifacts: [
    { role: 'primary_raw' },
    { role: 'independent_raw' },
    { role: 'independent_command' },
    { role: 'reconciliation' }
  ]
};

function valid(overrides = {}) {
  return {
    expected_commit_sha: sha,
    manifest,
    raw_bytes_reverified: true,
    reconciliation_verified: true,
    provider_ceiling_ambiguous: false,
    ...overrides
  };
}

test('accepts only an exact-commit manifest with independently reverified retained bytes', () => {
  const result = assessRetainedEvidenceHandoff(valid());
  assert.equal(result.handoff_status, 'accepted');
  assert.equal(result.exhaustive_workflow_evidence, true);
  assert.equal(result.deployment_claim_permitted, false);
  assert.deepEqual(result.blockers, []);
});

test('a structurally valid manifest alone cannot self-promote to exhaustive evidence', () => {
  const result = assessRetainedEvidenceHandoff(valid({ raw_bytes_reverified: false }));
  assert.equal(result.exhaustive_workflow_evidence, false);
  assert.ok(result.blockers.includes('retained_raw_bytes_not_reverified'));
});

test('rejects cross-commit handoffs', () => {
  const result = assessRetainedEvidenceHandoff(valid({ expected_commit_sha: 'c'.repeat(40) }));
  assert.ok(result.blockers.includes('manifest_commit_mismatch'));
});

test('rejects missing retained roles and cardinality drift', () => {
  const result = assessRetainedEvidenceHandoff(valid({
    manifest: { ...manifest, artifacts: manifest.artifacts.slice(0, 3) }
  }));
  assert.ok(result.blockers.includes('missing_artifact_role_reconciliation'));
  assert.ok(result.blockers.includes('artifact_cardinality_invalid'));
});

test('provider ceiling ambiguity remains fail-closed', () => {
  const result = assessRetainedEvidenceHandoff(valid({ provider_ceiling_ambiguous: true }));
  assert.equal(result.handoff_status, 'blocked');
  assert.ok(result.blockers.includes('provider_ceiling_ambiguous'));
});

test('rejects a manifest that attempts to permit deployment claims', () => {
  const result = assessRetainedEvidenceHandoff(valid({
    manifest: { ...manifest, deployment_claim_permitted: true }
  }));
  assert.ok(result.blockers.includes('manifest_claim_boundary_invalid'));
});
