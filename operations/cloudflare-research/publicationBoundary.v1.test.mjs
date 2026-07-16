import test from 'node:test';
import assert from 'node:assert/strict';
import { assessPublicationPacket } from './publicationBoundary.v1.mjs';

const base = {
  schema_version: 1,
  packet_id: 'CF-001-demo',
  audience: 'public',
  privacy_class: 'public',
  claim_type: 'research_summary',
  evidence_state: 'observed',
  contains_personal_identifiers: false,
  sources: [{
    locator: 'https://developers.cloudflare.com/workers/static-assets/headers/',
    source_status: 'primary',
    accessed_at: '2026-07-16T00:16:31Z'
  }],
  falsification_route: 'Re-fetch the cited primary documentation and compare the stated behavior.'
};

test('accepts a public observed research packet with primary provenance', () => {
  assert.deepEqual(assessPublicationPacket(base), {
    publishable: true,
    reasons: [],
    evidence_strength: 'primary_source_supported'
  });
});

test('rejects diagnosis and treatment claims', () => {
  for (const claim_type of ['diagnosis', 'treatment_recommendation', 'clinical_decision']) {
    const result = assessPublicationPacket({ ...base, claim_type });
    assert.equal(result.publishable, false);
    assert.ok(result.reasons.includes('medical_claim_forbidden'));
  }
});

test('rejects private or restricted packets', () => {
  for (const privacy_class of ['private', 'restricted']) {
    const result = assessPublicationPacket({ ...base, privacy_class });
    assert.equal(result.publishable, false);
    assert.ok(result.reasons.includes('privacy_class_not_public'));
  }
});

test('rejects unresolved and superseded evidence states', () => {
  for (const evidence_state of ['unresolved', 'superseded']) {
    const result = assessPublicationPacket({ ...base, evidence_state });
    assert.equal(result.publishable, false);
    assert.ok(result.reasons.includes('evidence_state_not_publishable'));
  }
});

test('requires explicit uncertainty for inferred or proposed claims', () => {
  const rejected = assessPublicationPacket({ ...base, evidence_state: 'inferred' });
  assert.ok(rejected.reasons.includes('uncertainty_statement_required'));

  const accepted = assessPublicationPacket({
    ...base,
    evidence_state: 'proposed',
    uncertainty_statement: 'This is a design proposal, not an observed platform guarantee.'
  });
  assert.equal(accepted.publishable, true);
});

test('fails closed when personal-identifier absence is not explicit', () => {
  const { contains_personal_identifiers, ...withoutBoundary } = base;
  const result = assessPublicationPacket(withoutBoundary);
  assert.equal(result.publishable, false);
  assert.ok(result.reasons.includes('personal_identifier_boundary_unproven'));
});

test('rejects missing, malformed, or untraceable provenance', () => {
  assert.ok(assessPublicationPacket({ ...base, sources: [] }).reasons.includes('sources_missing'));
  assert.ok(assessPublicationPacket({ ...base, sources: [{ locator: '', source_status: 'primary', accessed_at: '' }] }).reasons.includes('source_record_invalid'));
});
