import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRetainedEvidenceManifest } from './retained-evidence-manifest.mjs';

const sha = 'a'.repeat(40);
const digest = (c) => c.repeat(64);
const base = () => ({
  commit_sha: sha,
  artifacts: [
    { role: 'primary_raw', path: 'operations/evidence/primary.json', sha256: digest('1'), byte_length: 10, captured_at: '2026-07-13T05:20:00Z', method: 'rest-link-pagination' },
    { role: 'independent_raw', path: 'operations/evidence/independent.json', sha256: digest('2'), byte_length: 11, captured_at: '2026-07-13T05:21:00Z', method: 'gh-api-paginate-slurp' },
    { role: 'independent_command', path: 'operations/evidence/command.txt', sha256: digest('3'), byte_length: 12, captured_at: '2026-07-13T05:21:10Z', method: 'retained-command-text' },
    { role: 'reconciliation', path: 'operations/evidence/reconciliation.json', sha256: digest('4'), byte_length: 13, captured_at: '2026-07-13T05:22:00Z', method: 'fail-closed-reconciler' }
  ]
});

test('builds deterministic complete manifest without permitting deployment claims', () => {
  const result = buildRetainedEvidenceManifest(base());
  assert.equal(result.evidence_complete, true);
  assert.equal(result.deployment_claim_permitted, false);
  assert.match(result.manifest_sha256, /^[0-9a-f]{64}$/);
  assert.equal(result.artifacts.length, 4);
});

test('rejects missing required roles', () => {
  const input = base();
  input.artifacts.pop();
  assert.throws(() => buildRetainedEvidenceManifest(input), /missing required artifact role/);
});

test('rejects same-method independence claims', () => {
  const input = base();
  input.artifacts[1].method = input.artifacts[0].method;
  assert.throws(() => buildRetainedEvidenceManifest(input), /distinct methods/);
});

test('rejects secret-bearing fields anywhere in the manifest', () => {
  const input = base();
  input.authorization_token = 'do-not-retain';
  assert.throws(() => buildRetainedEvidenceManifest(input), /forbidden secret-bearing field/);
});

test('rejects stale mixed-run capture windows', () => {
  const input = base();
  input.artifacts[3].captured_at = '2026-07-13T06:00:00Z';
  assert.throws(() => buildRetainedEvidenceManifest(input), /capture window exceeds/);
});

test('rejects unsafe paths and duplicate bytes', () => {
  const unsafe = base();
  unsafe.artifacts[0].path = '../primary.json';
  assert.throws(() => buildRetainedEvidenceManifest(unsafe), /unsafe retained path/);

  const duplicate = base();
  duplicate.artifacts[1].sha256 = duplicate.artifacts[0].sha256;
  assert.throws(() => buildRetainedEvidenceManifest(duplicate), /duplicate artifact digest/);
});
