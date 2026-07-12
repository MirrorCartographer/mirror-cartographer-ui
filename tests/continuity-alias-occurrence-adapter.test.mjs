import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeScannerOutput } from '../scripts/continuity-alias-occurrence-adapter.mjs';
import { validateOccurrenceSet } from '../scripts/continuity-alias-occurrence-validator.mjs';

const base = {
  schema_version: 2,
  rows: [
    {
      raw_value: 'MC',
      normalized_value: 'Mirror Cartographer',
      entity_type: 'abbreviation',
      lifecycle_dimension: 'contextual_alias',
      lifecycle_status: 'active',
      confidence: 'high',
      claim_state: 'observed',
      source: { id: 'repo:decision-log:mc', kind: 'public', hash: null },
      observed_at: '2026-07-12',
      conflict: false
    }
  ]
};

test('normalizes scanner output into validator-complete schema v2 rows', () => {
  const normalized = normalizeScannerOutput(base);
  const result = validateOccurrenceSet(normalized);
  assert.equal(result.valid, true, result.errors.join('\n'));
  assert.match(normalized.rows[0].occurrence_id, /^occ-[a-f0-9]{24}$/);
  assert.equal(normalized.rows[0].claim_status, 'observed');
  assert.equal(normalized.rows[0].source_visibility, 'public_repository');
  assert.equal(normalized.rows[0].review_state, 'accepted');
});

test('generates deterministic occurrence ids', () => {
  const first = normalizeScannerOutput(base);
  const second = normalizeScannerOutput(structuredClone(base));
  assert.equal(first.rows[0].occurrence_id, second.rows[0].occurrence_id);
});

test('preserves conflict review requirements', () => {
  const input = structuredClone(base);
  input.rows = [
    { ...input.rows[0], lifecycle_status: 'active', conflict: true },
    { ...input.rows[0], lifecycle_status: 'superseded', conflict: true, observed_at: '2026-07-13' }
  ];
  const normalized = normalizeScannerOutput(input);
  assert.ok(normalized.rows.every((row) => row.review_state === 'conflict'));
  const result = validateOccurrenceSet(normalized);
  assert.equal(result.valid, true, result.errors.join('\n'));
});

test('keeps unresolved and weak-context rows out of accepted state', () => {
  const input = structuredClone(base);
  input.rows[0].claim_state = 'unresolved';
  input.rows[0].source.kind = 'unknown';
  const normalized = normalizeScannerOutput(input);
  assert.equal(normalized.rows[0].evidence_strength, 'weak_context');
  assert.equal(normalized.rows[0].review_state, 'needs_review');
  assert.equal(validateOccurrenceSet(normalized).valid, true);
});
