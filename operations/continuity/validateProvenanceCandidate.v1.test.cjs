'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateProvenanceCandidate } = require('./validateProvenanceCandidate.v1.cjs');

function base(overrides = {}) {
  return {
    schema_version: 1,
    record_id: 'PCA-M-004-valid',
    queue_item: 'M-RECONCILE-002',
    subject_identifier: 'M-004',
    candidate: {
      source_class: 'git_commit',
      locator: 'repo@commit:path',
      immutable_identity: '0123456789abcdef',
      observed_role: 'assigning_source',
      coverage_status: 'covered'
    },
    agreement_tests: Object.fromEntries(['namespace', 'authority', 'semantic_role', 'temporal_precedence', 'immutable_locator'].map((key) => [key, { status: 'pass', evidence: [`${key} evidence`] }])),
    classification: 'located_verified',
    claim_states: { observed: [], inferred: [], proposed: [], superseded: [], unresolved: [] },
    privacy: { class: 'public_repository_governance', contains_private_source_material: false },
    falsification_route: 'Replace with a stronger immutable assigning source.',
    ...overrides
  };
}

function validate(record) {
  return validateProvenanceCandidate(record);
}

test('accepts a covered immutable assigning source with all agreement tests passing', () => {
  assert.deepEqual(validate(base()), { valid: true, errors: [] });
});

test('accepts a downstream reference only when it is not promoted to provenance', () => {
  const record = base({
    candidate: { ...base().candidate, immutable_identity: 'commit:path', observed_role: 'downstream_reference' },
    agreement_tests: { ...base().agreement_tests, authority: { status: 'fail', evidence: ['reference does not assign identifier'] } },
    classification: 'downstream_reference_only'
  });
  assert.equal(validate(record).valid, true);
});

test('accepts a token collision only as noncapable', () => {
  const record = base({
    candidate: { ...base().candidate, immutable_identity: null, observed_role: 'token_collision' },
    agreement_tests: Object.fromEntries(Object.keys(base().agreement_tests).map((key) => [key, { status: 'fail', evidence: ['namespace collision'] }])),
    classification: 'noncapable_collision'
  });
  assert.equal(validate(record).valid, true);
});

test('requires coverage_blocked when branch or history coverage is incomplete', () => {
  const record = base({
    candidate: { ...base().candidate, coverage_status: 'partial' },
    classification: 'candidate_unverified'
  });
  const result = validate(record);
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('incomplete coverage requires coverage_blocked classification'));
});

test('rejects located_verified when one agreement test fails', () => {
  const record = base({
    agreement_tests: { ...base().agreement_tests, temporal_precedence: { status: 'fail', evidence: ['candidate postdates downstream claim'] } }
  });
  const result = validate(record);
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('located_verified requires temporal_precedence agreement'));
});

test('rejects located_verified without an immutable identity', () => {
  const record = base({ candidate: { ...base().candidate, immutable_identity: null } });
  const result = validate(record);
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('located_verified requires immutable identity'));
});
