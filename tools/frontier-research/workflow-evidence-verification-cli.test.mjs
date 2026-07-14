import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { REQUIRED_ROLES } from './workflow-evidence-retention-manifest-core.mjs';
import { main, verifyRetainedWorkflowEvidenceFromDisk } from './workflow-evidence-verification-cli.mjs';

const COMMIT = 'a'.repeat(40);
const json = value => JSON.stringify(value);
const texts = {
  primary_raw_enumeration: json({ commit_sha: COMMIT, workflow_runs: [] }),
  independent_raw_pages: json([{ commit_sha: COMMIT, workflow_runs: [] }]),
  independent_command: `gh api repos/o/r/actions/runs?head_sha=${COMMIT} --paginate --slurp`,
  primary_envelope: json({ commit_sha: COMMIT, complete: true, records: [] }),
  independent_envelope: json({ commit_sha: COMMIT, complete: true, records: [] }),
  reconciliation_result: json({ commit_sha: COMMIT, verified: true, reason: 'enumerations_agree' }),
  promotion_assessment: json({ commit_sha: COMMIT, verified: true, evidence_strength: 'exact_commit_reconciled' })
};
const sha256 = value => createHash('sha256').update(value, 'utf8').digest('hex');

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'workflow-evidence-cli-'));
  await mkdir(join(root, 'retained'));
  const manifest = {
    schema_version: 1,
    artifact_type: 'workflow_evidence_retention_manifest',
    commit_sha: COMMIT,
    entries: REQUIRED_ROLES.map(role => ({
      role,
      path: `retained/${role}.${role === 'independent_command' ? 'txt' : 'json'}`,
      media_type: role === 'independent_command' ? 'text/plain' : 'application/json',
      commit_sha: COMMIT,
      byte_length: Buffer.byteLength(texts[role], 'utf8'),
      sha256: sha256(texts[role])
    }))
  };
  for (const entry of manifest.entries) await writeFile(join(root, entry.path), texts[entry.role]);
  const manifestPath = join(root, 'manifest.json');
  await writeFile(manifestPath, JSON.stringify(manifest));
  return { root, manifest, manifestPath };
}

test('loads the seven manifest-bound artifacts and verifies the complete chain', async () => {
  const { manifestPath } = await fixture();
  const result = await verifyRetainedWorkflowEvidenceFromDisk({ manifestPath });
  assert.equal(result.verified, true);
  assert.equal(result.commit_sha, COMMIT);
});

test('rejects a manifest path escaping its own directory', async () => {
  const { manifest, manifestPath } = await fixture();
  manifest.entries[0].path = '../outside.json';
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(() => verifyRetainedWorkflowEvidenceFromDisk({ manifestPath }), /entry_path_escape_rejected:primary_raw_enumeration/);
});

test('rejects symlink substitution for a retained artifact', async () => {
  const { root, manifest, manifestPath } = await fixture();
  const entry = manifest.entries.find(item => item.role === 'independent_command');
  const target = join(root, 'command-target.txt');
  await writeFile(target, texts.independent_command);
  await import('node:fs/promises').then(({ unlink }) => unlink(join(root, entry.path)));
  await symlink(target, join(root, entry.path));
  await assert.rejects(() => verifyRetainedWorkflowEvidenceFromDisk({ manifestPath }), /retained_artifact_symlink_rejected:independent_command/);
});

test('writes verification output with no-overwrite semantics', async () => {
  const { root, manifestPath } = await fixture();
  const output = join(root, 'verification.json');
  const result = await main(['--manifest', manifestPath, '--output', output]);
  assert.equal(result.verified, true);
  assert.equal(JSON.parse(await readFile(output, 'utf8')).verified, true);
  await assert.rejects(() => main(['--manifest', manifestPath, '--output', output]), error => error.code === 'EEXIST');
});
