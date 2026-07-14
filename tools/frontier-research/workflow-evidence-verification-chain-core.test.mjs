import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { REQUIRED_ROLES } from './workflow-evidence-retention-manifest-core.mjs';
import { verifyWorkflowEvidenceChain } from './workflow-evidence-verification-chain-core.mjs';

const COMMIT = 'a'.repeat(40);
const json = (value) => JSON.stringify(value);
const texts = {
  primary_raw_enumeration: json({ commit_sha: COMMIT, workflow_runs: [] }),
  independent_raw_pages: json([{ commit_sha: COMMIT, workflow_runs: [] }]),
  independent_command: `gh api repos/o/r/actions/runs?head_sha=${COMMIT} --paginate --slurp`,
  primary_envelope: json({ commit_sha: COMMIT, complete: true, records: [] }),
  independent_envelope: json({ commit_sha: COMMIT, complete: true, records: [] }),
  reconciliation_result: json({ commit_sha: COMMIT, verified: true, reason: 'enumerations_agree' }),
  promotion_assessment: json({ commit_sha: COMMIT, verified: true, evidence_strength: 'exact_commit_reconciled' })
};
const sha256 = (value) => createHash('sha256').update(value, 'utf8').digest('hex');
const manifest = {
  schema_version: 1,
  artifact_type: 'workflow_evidence_retention_manifest',
  commit_sha: COMMIT,
  entries: REQUIRED_ROLES.map((role) => ({
    role,
    path: `retained/${role}.${role === 'independent_command' ? 'txt' : 'json'}`,
    media_type: role === 'independent_command' ? 'text/plain' : 'application/json',
    commit_sha: COMMIT,
    byte_length: Buffer.byteLength(texts[role], 'utf8'),
    sha256: sha256(texts[role])
  }))
};

test('accepts only after byte and semantic verification both pass', () => {
  const result = verifyWorkflowEvidenceChain({ manifest, retainedArtifacts: texts });
  assert.equal(result.verified, true);
  assert.equal(result.stage, 'complete');
  assert.equal(result.commit_sha, COMMIT);
});

test('stops at byte retention and does not claim semantic verification', () => {
  const changed = { ...texts, primary_envelope: `${texts.primary_envelope} ` };
  const result = verifyWorkflowEvidenceChain({ manifest, retainedArtifacts: changed });
  assert.equal(result.verified, false);
  assert.equal(result.stage, 'byte_retention');
  assert.equal(result.reason, 'byte_length_mismatch:primary_envelope');
  assert.equal(result.semantic_verification, undefined);
});

test('preserves successful byte evidence when semantic binding fails', () => {
  const changedTexts = { ...texts, reconciliation_result: json({ commit_sha: COMMIT, verified: false, reason: 'diverged' }) };
  const changedManifest = structuredClone(manifest);
  const entry = changedManifest.entries.find((item) => item.role === 'reconciliation_result');
  entry.byte_length = Buffer.byteLength(changedTexts.reconciliation_result, 'utf8');
  entry.sha256 = sha256(changedTexts.reconciliation_result);
  const result = verifyWorkflowEvidenceChain({ manifest: changedManifest, retainedArtifacts: changedTexts });
  assert.equal(result.verified, false);
  assert.equal(result.stage, 'semantic_binding');
  assert.equal(result.reason, 'reconciliation_not_verified');
  assert.equal(result.byte_verification.verified, true);
});

test('rejects cross-commit semantic payload after valid byte binding', () => {
  const changedTexts = { ...texts, promotion_assessment: json({ commit_sha: 'b'.repeat(40), verified: true, evidence_strength: 'exact_commit_reconciled' }) };
  const changedManifest = structuredClone(manifest);
  const entry = changedManifest.entries.find((item) => item.role === 'promotion_assessment');
  entry.byte_length = Buffer.byteLength(changedTexts.promotion_assessment, 'utf8');
  entry.sha256 = sha256(changedTexts.promotion_assessment);
  const result = verifyWorkflowEvidenceChain({ manifest: changedManifest, retainedArtifacts: changedTexts });
  assert.equal(result.stage, 'semantic_binding');
  assert.equal(result.reason, 'commit_claim_mismatch:promotion_assessment:commit_sha');
});
