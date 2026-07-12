import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateEvidenceTransition } from './evidence-transition-gate.mjs';

const now = new Date('2026-07-12T06:30:00Z');
const base = {
  claim_id: 'R-006:C1',
  status: 'proposed',
  evidence_strength: 'weak',
  sources: [{ uri: 'https://example.test/source', source_status: 'primary' }],
  falsification: { test: 'Reject if a counterexample is reproduced.' },
  provenance: { generated_at: '2026-07-12T06:00:00Z' }
};

test('accepts a complete proposed claim', () => {
  assert.equal(evaluateEvidenceTransition(base, now).accepted, true);
});

test('rejects observed claims with weak evidence', () => {
  const result = evaluateEvidenceTransition({ ...base, status: 'observed' }, now);
  assert.deepEqual(result.reasons, ['observed_requires_moderate_evidence']);
});

test('rejects inference without parent claims', () => {
  const result = evaluateEvidenceTransition({ ...base, status: 'inferred' }, now);
  assert.ok(result.reasons.includes('inference_requires_parent_claims'));
});

test('rejects future-dated provenance', () => {
  const result = evaluateEvidenceTransition({ ...base, provenance: { generated_at: '2026-07-13T00:00:00Z' } }, now);
  assert.ok(result.reasons.includes('future_dated'));
});

test('rejects superseded claim without replacement', () => {
  const result = evaluateEvidenceTransition({ ...base, status: 'superseded' }, now);
  assert.ok(result.reasons.includes('superseded_by_required'));
});
