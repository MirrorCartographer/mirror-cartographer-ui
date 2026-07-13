import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRetainedRunManifest } from './vercel-retained-run-manifest.mjs';

const validInput = {
  repository: 'MirrorCartographer/mirror-cartographer-ui',
  workflow: 'Vercel retained evidence contract',
  run_id: '123456789',
  run_attempt: '2',
  event_name: 'workflow_dispatch',
  ref: 'refs/heads/main',
  sha: '0123456789abcdef0123456789abcdef01234567',
  artifact_name: 'vercel-retained-evidence-contract-0123456789abcdef0123456789abcdef01234567',
  retention_days: '30',
  generated_at: '2026-07-13T17:10:00Z'
};

test('builds a normalized commit-bound run manifest with an explicit claim boundary', () => {
  const manifest = buildRetainedRunManifest(validInput);

  assert.equal(manifest.schema_version, 1);
  assert.equal(manifest.evidence_class, 'commit_bound_ci_contract');
  assert.equal(manifest.sha, validInput.sha);
  assert.equal(manifest.run_id, 123456789);
  assert.equal(manifest.run_attempt, 2);
  assert.equal(manifest.retention_days, 30);
  assert.equal(manifest.generated_at, '2026-07-13T17:10:00.000Z');
  assert.match(manifest.claim_boundary, /does not prove a Vercel deployment/i);
});

test('rejects missing required provenance fields', () => {
  assert.throws(
    () => buildRetainedRunManifest({ ...validInput, run_id: '' }),
    /Missing required run manifest field: run_id/
  );
});

test('rejects mutable or malformed commit identity', () => {
  assert.throws(
    () => buildRetainedRunManifest({ ...validInput, sha: 'main' }),
    /lowercase 40-character commit SHA/
  );
});

test('rejects non-positive numeric provenance fields', () => {
  assert.throws(
    () => buildRetainedRunManifest({ ...validInput, run_attempt: '0' }),
    /run_attempt must be a positive integer/
  );
});

test('rejects invalid generation timestamps', () => {
  assert.throws(
    () => buildRetainedRunManifest({ ...validInput, generated_at: 'not-a-date' }),
    /generated_at must be an ISO-8601 timestamp/
  );
});
