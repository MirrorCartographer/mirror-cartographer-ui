import assert from 'node:assert/strict';
import { buildWorkflowEvidenceBundle } from './workflow-evidence-bundle.mjs';

const sha = 'a'.repeat(40);
const run = { id: 7, head_sha: sha, event: 'push', status: 'completed', conclusion: 'success', workflow_id: 11, run_attempt: 1 };
const enumeration = { complete: true, commitSha: sha, runs: [run], pagesFetched: 1 };
const sourceA = { method: 'repository_api_link_pagination', retrieved_at: '2026-07-12T22:19:00Z', pages_fetched: 1 };
const sourceB = { method: 'gh_api_paginate', retrieved_at: '2026-07-12T22:19:02Z', pages_fetched: 1 };
const rateLimitProof = {
  ok: true,
  promotion_permitted: true,
  evidence_class: 'dual_client_retained_response_header_contract',
  resource: 'actions',
  clients: {
    primary: { page_count: 1, minimum_remaining: 4998, classification: 'terminal_sequence_accepted' },
    independent: { page_count: 1, minimum_remaining: 4997, classification: 'terminal_sequence_accepted' }
  }
};
const baseInput = { commitSha: sha, primary: enumeration, independent: structuredClone(enumeration), primarySource: sourceA, independentSource: sourceB, rateLimitProof, generatedAt: '2026-07-12T22:19:05Z' };
let passed = 0;
function test(name, fn) { fn(); passed += 1; console.log(`ok ${passed} - ${name}`); }

test('matching raw enumerations and accepted rate-limit proof produce strong bundle', () => {
  const bundle = buildWorkflowEvidenceBundle(baseInput);
  assert.equal(bundle.schema_version, 2);
  assert.equal(bundle.verified, true);
  assert.equal(bundle.rate_limit_proof.resource, 'actions');
  assert.match(bundle.rate_limit_proof_sha256, /^[0-9a-f]{64}$/);
  assert.match(bundle.raw_enumeration_digests.primary_sha256, /^[0-9a-f]{64}$/);
  assert.equal(bundle.raw_enumeration_digests.primary_sha256, bundle.raw_enumeration_digests.independent_sha256);
  assert.equal(bundle.retention_contract.retain_raw_response_headers, true);
});

test('object key ordering does not change enumeration digest', () => {
  const alternate = { runs: [{ workflow_id: 11, id: 7, run_attempt: 1, status: 'completed', event: 'push', head_sha: sha, conclusion: 'success' }], commitSha: sha, complete: true, pagesFetched: 1 };
  const bundle = buildWorkflowEvidenceBundle({ ...baseInput, independent: alternate });
  assert.equal(bundle.raw_enumeration_digests.primary_sha256, bundle.raw_enumeration_digests.independent_sha256);
});

test('divergence fails closed but accepted rate-limit proof remains retained', () => {
  const other = structuredClone(enumeration);
  other.runs[0].conclusion = 'failure';
  const bundle = buildWorkflowEvidenceBundle({ ...baseInput, independent: other });
  assert.equal(bundle.verified, false);
  assert.equal(bundle.evidence_strength, 'rejected');
  assert.equal(bundle.reconciliation.reason, 'enumeration_divergence');
  assert.equal(bundle.rate_limit_proof.evidence_class, 'dual_client_retained_response_header_contract');
});

test('provider ceiling ambiguity fails closed', () => {
  const bundle = buildWorkflowEvidenceBundle({ ...baseInput, providerCeilingAmbiguous: true });
  assert.equal(bundle.verified, false);
  assert.equal(bundle.reconciliation.reason, 'provider_ceiling_ambiguous');
});

test('unapproved source method is rejected', () => {
  assert.throws(() => buildWorkflowEvidenceBundle({ ...baseInput, primarySource: { ...sourceA, method: 'connector_snapshot' } }), /repository_api_link_pagination_source_required/);
});

test('missing source page count is rejected', () => {
  assert.throws(() => buildWorkflowEvidenceBundle({ ...baseInput, primarySource: { ...sourceA, pages_fetched: null } }), /repository_api_link_pagination_pages_fetched_invalid/);
});

test('generated time cannot precede either source retrieval', () => {
  assert.throws(() => buildWorkflowEvidenceBundle({ ...baseInput, generatedAt: '2026-07-12T22:19:01Z' }), /generated_at_precedes_source_retrieval/);
});

test('missing rate-limit proof is rejected before bundle construction', () => {
  assert.throws(() => buildWorkflowEvidenceBundle({ ...baseInput, rateLimitProof: undefined }), /dual_client_rate_limit_proof_required/);
});

test('upstream rejected rate-limit proof cannot be promoted', () => {
  assert.throws(() => buildWorkflowEvidenceBundle({ ...baseInput, rateLimitProof: { ...rateLimitProof, promotion_permitted: false } }), /dual_client_rate_limit_proof_not_accepted/);
});

test('malformed client counters are rejected', () => {
  const malformed = structuredClone(rateLimitProof);
  malformed.clients.independent.page_count = 0;
  assert.throws(() => buildWorkflowEvidenceBundle({ ...baseInput, rateLimitProof: malformed }), /independent_rate_limit_page_count_invalid/);
});

test('primary header-proof page count must cover every enumerated page', () => {
  const proof = structuredClone(rateLimitProof);
  const primarySource = { ...sourceA, pages_fetched: 2 };
  assert.throws(() => buildWorkflowEvidenceBundle({ ...baseInput, primarySource, rateLimitProof: proof }), /primary_rate_limit_page_count_mismatch/);
});

test('independent header-proof page count must cover every enumerated page', () => {
  const proof = structuredClone(rateLimitProof);
  const independentSource = { ...sourceB, pages_fetched: 2 };
  assert.throws(() => buildWorkflowEvidenceBundle({ ...baseInput, independentSource, rateLimitProof: proof }), /independent_rate_limit_page_count_mismatch/);
});

test('rate-limit proof digest changes when retained proof changes', () => {
  const first = buildWorkflowEvidenceBundle(baseInput);
  const changed = structuredClone(rateLimitProof);
  changed.clients.primary.minimum_remaining -= 1;
  const second = buildWorkflowEvidenceBundle({ ...baseInput, rateLimitProof: changed });
  assert.notEqual(first.rate_limit_proof_sha256, second.rate_limit_proof_sha256);
});

console.log(`${passed} passed, 0 failed`);
