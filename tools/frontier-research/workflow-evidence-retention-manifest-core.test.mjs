import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { REQUIRED_ROLES, verifyWorkflowEvidenceRetentionManifest } from './workflow-evidence-retention-manifest-core.mjs';

const COMMIT = 'a'.repeat(40);
const texts = Object.fromEntries(REQUIRED_ROLES.map((role) => [role, role === 'independent_command' ? 'gh api --paginate --slurp' : JSON.stringify({ role, commit_sha: COMMIT })]));
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

test('accepts a complete byte-bound exact-commit retention set', () => {
  const result = verifyWorkflowEvidenceRetentionManifest({ manifest, retainedArtifacts: texts });
  assert.equal(result.verified, true);
  assert.equal(result.verified_entries.length, REQUIRED_ROLES.length);
});

test('rejects a missing required role', () => {
  const changed = { ...manifest, entries: manifest.entries.slice(1) };
  assert.equal(verifyWorkflowEvidenceRetentionManifest({ manifest: changed, retainedArtifacts: texts }).reason, 'required_role_missing:primary_raw_enumeration');
});

test('rejects cross-commit evidence', () => {
  const changed = structuredClone(manifest);
  changed.entries[2].commit_sha = 'b'.repeat(40);
  assert.equal(verifyWorkflowEvidenceRetentionManifest({ manifest: changed, retainedArtifacts: texts }).reason, 'entry_commit_mismatch:independent_command');
});

test('rejects same-length retained artifact mutation', () => {
  const changedTexts = { ...texts, primary_envelope: texts.primary_envelope.replace('primary_envelope', 'primary_envelopf') };
  assert.equal(verifyWorkflowEvidenceRetentionManifest({ manifest, retainedArtifacts: changedTexts }).reason, 'sha256_mismatch:primary_envelope');
});

test('rejects duplicate semantic roles', () => {
  const changed = { ...manifest, entries: [...manifest.entries, manifest.entries[0]] };
  assert.equal(verifyWorkflowEvidenceRetentionManifest({ manifest: changed, retainedArtifacts: texts }).reason, 'duplicate_role');
});
