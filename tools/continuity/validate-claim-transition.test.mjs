import test from 'node:test';
import assert from 'node:assert/strict';
import { validateClaimTransition } from './validate-claim-transition.mjs';

const base = {
  schema_version: 1,
  transition_id: 'ct-001',
  subject_id: 'language.alias.sample',
  recorded_at: '2026-07-12T17:45:00Z',
  from_claim: {
    claim_id: 'claim-a',
    statement_summary: 'An earlier interpretation existed.',
    epistemic_state: 'observed',
    lifecycle_state: 'historical'
  },
  to_claim: {
    claim_id: 'claim-b',
    statement_summary: 'The interpretation was refined without erasing the earlier state.',
    epistemic_state: 'inferred',
    lifecycle_state: 'active'
  },
  transition_kind: 'refine',
  reason: 'New provenance narrowed the meaning.',
  provenance: {
    source_refs: ['operations/evidence/example.json'],
    evidence_strength: 'moderate',
    review_state: 'reviewed'
  },
  privacy: {
    visibility: 'internal',
    contains_raw_private_content: false
  }
};

const clone = value => structuredClone(value);

test('accepts a valid append-only refinement', () => {
  const result = validateClaimTransition(base);
  assert.equal(result.valid, true, result.errors.join('\n'));
});

test('rejects raw private content', () => {
  const record = clone(base);
  record.privacy.visibility = 'private';
  record.privacy.content_hash = 'sha256:opaque-example';
  record.privacy.contains_raw_private_content = true;
  const result = validateClaimTransition(record);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /must be false/);
});

test('requires a hash for private provenance', () => {
  const record = clone(base);
  record.privacy.visibility = 'private';
  const result = validateClaimTransition(record);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /content_hash/);
});

test('preserves contradiction as conflict instead of silently choosing a winner', () => {
  const record = clone(base);
  record.transition_kind = 'contradict';
  record.to_claim.lifecycle_state = 'conflicted';
  record.provenance.review_state = 'conflict';
  const result = validateClaimTransition(record);
  assert.equal(result.valid, true, result.errors.join('\n'));
});

test('rejects contradiction without conflict state', () => {
  const record = clone(base);
  record.transition_kind = 'contradict';
  const result = validateClaimTransition(record);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /conflicted/);
  assert.match(result.errors.join('\n'), /review_state=conflict/);
});

test('rejects supersession that fails to preserve the earlier claim as superseded', () => {
  const record = clone(base);
  record.transition_kind = 'supersede';
  const result = validateClaimTransition(record);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /from_claim.epistemic_state=superseded/);
});
