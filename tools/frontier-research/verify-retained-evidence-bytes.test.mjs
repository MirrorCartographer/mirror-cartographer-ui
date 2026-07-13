import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyRetainedEvidenceBytes } from './verify-retained-evidence-bytes.mjs';

const bytesByPath = new Map([
  ['/repo/operations/evidence/primary.json', Buffer.from('primary')],
  ['/repo/operations/evidence/independent.json', Buffer.from('independent')],
  ['/repo/operations/evidence/command.txt', Buffer.from('gh api --paginate --slurp')],
  ['/repo/operations/evidence/reconciliation.json', Buffer.from('reconciled')]
]);

function artifact(role, relativePath) {
  const bytes = bytesByPath.get(`/repo/${relativePath}`);
  return {
    role,
    path: relativePath,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
    byte_length: bytes.byteLength
  };
}

function manifest() {
  return {
    evidence_complete: true,
    artifacts: [
      artifact('primary_raw', 'operations/evidence/primary.json'),
      artifact('independent_raw', 'operations/evidence/independent.json'),
      artifact('independent_command', 'operations/evidence/command.txt'),
      artifact('reconciliation', 'operations/evidence/reconciliation.json')
    ]
  };
}

const readFile = async absolutePath => {
  const bytes = bytesByPath.get(absolutePath);
  if (!bytes) throw new Error(`ENOENT:${absolutePath}`);
  return bytes;
};

test('accepts only when every retained byte matches metadata', async () => {
  const result = await verifyRetainedEvidenceBytes(manifest(), { rootDirectory: '/repo', readFile });
  assert.equal(result.verified, true);
  assert.equal(result.verified_artifacts.length, 4);
  assert.equal(result.deployment_claim_permitted, false);
  assert.match(result.verification_sha256, /^[0-9a-f]{64}$/);
});

test('rejects a digest mismatch', async () => {
  const input = manifest();
  input.artifacts[0].sha256 = '0'.repeat(64);
  await assert.rejects(
    verifyRetainedEvidenceBytes(input, { rootDirectory: '/repo', readFile }),
    /primary_raw\.sha256 mismatch/
  );
});

test('rejects a byte-length mismatch', async () => {
  const input = manifest();
  input.artifacts[1].byte_length += 1;
  await assert.rejects(
    verifyRetainedEvidenceBytes(input, { rootDirectory: '/repo', readFile }),
    /independent_raw\.byte_length mismatch/
  );
});

test('rejects traversal and non-evidence paths', async () => {
  const traversal = manifest();
  traversal.artifacts[2].path = 'operations/evidence/../secret.txt';
  await assert.rejects(
    verifyRetainedEvidenceBytes(traversal, { rootDirectory: '/repo', readFile }),
    /unsafe/
  );

  const outside = manifest();
  outside.artifacts[2].path = 'tmp/command.txt';
  await assert.rejects(
    verifyRetainedEvidenceBytes(outside, { rootDirectory: '/repo', readFile }),
    /must be under operations\/evidence/
  );
});

test('rejects missing and duplicate roles', async () => {
  const missing = manifest();
  missing.artifacts.pop();
  await assert.rejects(
    verifyRetainedEvidenceBytes(missing, { rootDirectory: '/repo', readFile }),
    /missing required artifact role: reconciliation/
  );

  const duplicate = manifest();
  duplicate.artifacts[3] = { ...duplicate.artifacts[0] };
  await assert.rejects(
    verifyRetainedEvidenceBytes(duplicate, { rootDirectory: '/repo', readFile }),
    /duplicate artifact role: primary_raw/
  );
});

test('rejects incomplete manifests before reading files', async () => {
  const input = manifest();
  input.evidence_complete = false;
  let reads = 0;
  await assert.rejects(
    verifyRetainedEvidenceBytes(input, {
      rootDirectory: '/repo',
      readFile: async value => {
        reads += 1;
        return readFile(value);
      }
    }),
    /evidence_complete must be true/
  );
  assert.equal(reads, 0);
});
