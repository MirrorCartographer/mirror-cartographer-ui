import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyWorkflowEvidenceSemanticBinding } from './workflow-evidence-semantic-binding-core.mjs';

const sha = 'a'.repeat(40);
const manifest = { schema_version: 1, artifact_type: 'workflow_evidence_retention_manifest', commit_sha: sha };
const byteVerification = { verified: true, commit_sha: sha };

function artifacts() {
  return {
    primary_raw_enumeration: JSON.stringify({ requested_commit_sha: sha, workflow_runs: [] }),
    independent_raw_pages: JSON.stringify([{ head_sha: sha, id: 1 }]),
    independent_command: `gh api --paginate --slurp repos/o/r/actions/runs?head_sha=${sha}`,
    primary_envelope: JSON.stringify({ commit_sha: sha, complete: true, records: [] }),
    independent_envelope: JSON.stringify({ commit_sha: sha, complete: true, runs: [] }),
    reconciliation_result: JSON.stringify({ commit_sha: sha, verified: true, reason: 'enumerations_agree' }),
    promotion_assessment: JSON.stringify({ commit_sha: sha, verified: true, evidence_strength: 'complete' })
  };
}

function verify(overrides = {}) {
  return verifyWorkflowEvidenceSemanticBinding({ manifest, retainedArtifacts: artifacts(), byteVerification, ...overrides });
}

test('accepts byte-verified evidence with role shapes and exact internal commit claims', () => {
  assert.equal(verify().verified, true);
});

test('rejects digest-only promotion without prior byte verification', () => {
  assert.equal(verify({ byteVerification: { verified: false } }).reason, 'byte_verification_required');
});

test('rejects a role-substituted JSON payload', () => {
  const retainedArtifacts = artifacts();
  retainedArtifacts.reconciliation_result = JSON.stringify({ commit_sha: sha, complete: true, records: [] });
  assert.equal(verify({ retainedArtifacts }).reason, 'reconciliation_not_verified');
});

test('rejects a nested cross-commit claim even when the top-level commit matches', () => {
  const retainedArtifacts = artifacts();
  retainedArtifacts.primary_envelope = JSON.stringify({ commit_sha: sha, complete: true, records: [{ head_sha: 'b'.repeat(40) }] });
  assert.equal(verify({ retainedArtifacts }).reason, 'commit_claim_mismatch:primary_envelope:head_sha');
});

test('rejects an independent command that does not prove exhaustive slurped pagination', () => {
  const retainedArtifacts = artifacts();
  retainedArtifacts.independent_command = `gh api repos/o/r/actions/runs?head_sha=${sha}`;
  assert.equal(verify({ retainedArtifacts }).reason, 'independent_command_token_missing:--paginate');
});

test('rejects JSON evidence with no internal exact-commit claim', () => {
  const retainedArtifacts = artifacts();
  retainedArtifacts.promotion_assessment = JSON.stringify({ verified: true, evidence_strength: 'complete' });
  assert.equal(verify({ retainedArtifacts }).reason, 'commit_claim_missing:promotion_assessment');
});
