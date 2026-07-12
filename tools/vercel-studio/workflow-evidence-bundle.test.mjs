import assert from 'node:assert/strict';
import { buildWorkflowEvidenceBundle } from './workflow-evidence-bundle.mjs';

const sha = 'a'.repeat(40);
const run = { id: 7, head_sha: sha, event: 'push', status: 'completed', conclusion: 'success', workflow_id: 11, run_attempt: 1 };
const enumeration = { complete: true, commitSha: sha, runs: [run], pagesFetched: 1 };
const sourceA = { method: 'repository_api_link_pagination', retrieved_at: '2026-07-12T22:19:00Z', pages_fetched: 1 };
const sourceB = { method: 'gh_api_paginate', retrieved_at: '2026-07-12T22:19:02Z', pages_fetched: 1 };
let passed = 0;
function test(name, fn) { fn(); passed += 1; console.log(`ok ${passed} - ${name}`); }

test('matching raw enumerations produce strong bundle', () => {
  const bundle = buildWorkflowEvidenceBundle({ commitSha: sha, primary: enumeration, independent: structuredClone(enumeration), primarySource: sourceA, independentSource: sourceB, generatedAt: '2026-07-12T22:19:05Z' });
  assert.equal(bundle.verified, true);
  assert.match(bundle.raw_enumeration_digests.primary_sha256, /^[0-9a-f]{64}$/);
  assert.equal(bundle.raw_enumeration_digests.primary_sha256, bundle.raw_enumeration_digests.independent_sha256);
});

test('object key ordering does not change digest', () => {
  const alternate = { runs: [{ workflow_id: 11, id: 7, run_attempt: 1, status: 'completed', event: 'push', head_sha: sha, conclusion: 'success' }], commitSha: sha, complete: true, pagesFetched: 1 };
  const bundle = buildWorkflowEvidenceBundle({ commitSha: sha, primary: enumeration, independent: alternate, primarySource: sourceA, independentSource: sourceB, generatedAt: '2026-07-12T22:19:05Z' });
  assert.equal(bundle.raw_enumeration_digests.primary_sha256, bundle.raw_enumeration_digests.independent_sha256);
});

test('divergence fails closed but remains retained', () => {
  const other = structuredClone(enumeration);
  other.runs[0].conclusion = 'failure';
  const bundle = buildWorkflowEvidenceBundle({ commitSha: sha, primary: enumeration, independent: other, primarySource: sourceA, independentSource: sourceB, generatedAt: '2026-07-12T22:19:05Z' });
  assert.equal(bundle.verified, false);
  assert.equal(bundle.evidence_strength, 'rejected');
  assert.equal(bundle.reconciliation.reason, 'enumeration_divergence');
});

test('provider ceiling ambiguity fails closed', () => {
  const bundle = buildWorkflowEvidenceBundle({ commitSha: sha, primary: enumeration, independent: enumeration, primarySource: sourceA, independentSource: sourceB, generatedAt: '2026-07-12T22:19:05Z', providerCeilingAmbiguous: true });
  assert.equal(bundle.verified, false);
  assert.equal(bundle.reconciliation.reason, 'provider_ceiling_ambiguous');
});

test('unapproved source method is rejected', () => {
  assert.throws(() => buildWorkflowEvidenceBundle({ commitSha: sha, primary: enumeration, independent: enumeration, primarySource: { ...sourceA, method: 'connector_snapshot' }, independentSource: sourceB, generatedAt: '2026-07-12T22:19:05Z' }), /repository_api_link_pagination_source_required/);
});

console.log(`${passed} passed, 0 failed`);
