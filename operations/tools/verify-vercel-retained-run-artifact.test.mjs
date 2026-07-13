import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { verifyRetainedRunArtifact } from './verify-vercel-retained-run-artifact.mjs';

const sha = 'a'.repeat(40);

function digest(content) {
  return createHash('sha256').update(content).digest('hex');
}

async function fixture(overrides = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'vercel-retained-run-'));
  const tap = overrides.tap ?? 'TAP version 13\n1..1\nok 1 - retained manifest\n';
  const manifest = {
    schema_version: 1,
    evidence_class: 'commit_bound_ci_contract',
    claim_boundary: 'test',
    repository: 'MirrorCartographer/mirror-cartographer-ui',
    workflow: 'Vercel retained run manifest contract',
    run_id: 123,
    run_attempt: 2,
    event_name: 'workflow_dispatch',
    ref: 'refs/heads/main',
    sha,
    artifact_name: `vercel-retained-run-manifest-${sha}`,
    retention_days: 30,
    generated_at: '2026-07-13T17:20:00.000Z',
    ...overrides.manifest
  };
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  await writeFile(join(directory, 'vercel-retained-run-manifest.json'), manifestText);
  await writeFile(join(directory, 'vercel-retained-run-manifest.tap'), tap);
  const artifactLines = overrides.artifactLines ?? [
    `${digest(manifestText)}  vercel-retained-run-manifest.json`,
    `${digest(tap)}  vercel-retained-run-manifest.tap`
  ];
  await writeFile(join(directory, 'vercel-retained-run-manifest-artifacts.sha256'), `${artifactLines.join('\n')}\n`);
  const sourceLines = overrides.sourceLines ?? [
    `${'1'.repeat(64)}  .github/workflows/vercel-retained-run-manifest-contract.yml`,
    `${'2'.repeat(64)}  operations/tools/vercel-retained-run-manifest.mjs`,
    `${'3'.repeat(64)}  operations/tools/vercel-retained-run-manifest.test.mjs`
  ];
  await writeFile(join(directory, 'vercel-retained-run-manifest-sources.sha256'), `${sourceLines.join('\n')}\n`);
  return directory;
}

test('verifies coherent retained artifact identity and digests', async () => {
  const directory = await fixture();
  const result = await verifyRetainedRunArtifact({ directory, expectedSha: sha, expectedRunId: 123, expectedRunAttempt: 2 });
  assert.equal(result.verified, true);
  assert.equal(result.artifact_files_verified, 2);
  assert.equal(result.source_digest_entries, 3);
});

test('rejects commit mismatch', async () => {
  const directory = await fixture();
  await assert.rejects(
    verifyRetainedRunArtifact({ directory, expectedSha: 'b'.repeat(40), expectedRunId: 123, expectedRunAttempt: 2 }),
    /commit mismatch/
  );
});

test('rejects tampered artifact content', async () => {
  const directory = await fixture();
  await writeFile(join(directory, 'vercel-retained-run-manifest.tap'), 'tampered\n');
  await assert.rejects(
    verifyRetainedRunArtifact({ directory, expectedSha: sha, expectedRunId: 123, expectedRunAttempt: 2 }),
    /Digest mismatch/
  );
});

test('rejects unsafe digest paths', async () => {
  const directory = await fixture({
    artifactLines: [`${'0'.repeat(64)}  ../escape.txt`]
  });
  await assert.rejects(
    verifyRetainedRunArtifact({ directory, expectedSha: sha, expectedRunId: 123, expectedRunAttempt: 2 }),
    /Unsafe digest manifest path/
  );
});

test('rejects incomplete source binding', async () => {
  const directory = await fixture({
    sourceLines: [`${'1'.repeat(64)}  operations/tools/vercel-retained-run-manifest.mjs`]
  });
  await assert.rejects(
    verifyRetainedRunArtifact({ directory, expectedSha: sha, expectedRunId: 123, expectedRunAttempt: 2 }),
    /Missing source digest/
  );
});
