import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyPagesEvidence } from './verify-pages-evidence.mjs';

const base = {
  project: { canonical_origin: 'https://mc-research.pages.dev', source: 'cloudflare_pages_api', custom_domains: ['research.example.org'] },
  deployment: { url: 'https://abc123.mc-research.pages.dev', commit_sha: 'a'.repeat(40) },
  network: { dns_resolved: true, http_status: 200 },
  identity: { surface: 'mirror-cartographer-research', served_commit: 'a'.repeat(40) },
  provenance: { artifact_digest: 'b'.repeat(64), privacy_review: 'passed' }
};

test('accepts a complete commit-bound Pages evidence chain', () => {
  const result = verifyPagesEvidence(base);
  assert.equal(result.ok, true);
  assert.equal(result.claims.scientific_truth_established, false);
});

test('rejects inferred hostname authority', () => {
  const result = verifyPagesEvidence({ ...base, project: { ...base.project, source: 'project_name_inference' } });
  assert.equal(result.code, 'PROJECT_AUTHORITY_MISSING');
});

test('rejects lookalike deployment host', () => {
  const result = verifyPagesEvidence({ ...base, deployment: { ...base.deployment, url: 'https://mc-research.pages.dev.example.net' } });
  assert.equal(result.code, 'HOSTNAME_NOT_BOUND');
});

test('rejects served commit mismatch', () => {
  const result = verifyPagesEvidence({ ...base, identity: { ...base.identity, served_commit: 'c'.repeat(40) } });
  assert.equal(result.code, 'IDENTITY_MISMATCH');
});

test('rejects missing privacy review', () => {
  const result = verifyPagesEvidence({ ...base, provenance: { ...base.provenance, privacy_review: 'pending' } });
  assert.equal(result.code, 'PROVENANCE_INCOMPLETE');
});
