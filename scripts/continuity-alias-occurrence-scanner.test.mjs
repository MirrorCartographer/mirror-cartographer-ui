import test from 'node:test';
import assert from 'node:assert/strict';
import { scanAliasOccurrences } from './continuity-alias-occurrence-scanner.mjs';

const registry = {
  aliases: [
    {
      raw_value: 'Mirror Cartographer',
      normalized_value: 'Mirror Cartographer',
      type: 'project_name',
      lifecycle_dimension: 'canonical_entity',
      status: 'canonical',
      confidence: 'high'
    },
    {
      raw_value: 'MC',
      normalized_value: 'Mirror Cartographer',
      type: 'abbreviation',
      lifecycle_dimension: 'contextual_alias',
      status: 'accepted_contextual_alias',
      confidence: 'high'
    }
  ]
};

const base = {
  raw_value: 'MC',
  source_id: 'chat-1',
  source_kind: 'private',
  source_hash: 'sha256:x',
  observed_at: '2026-01-01',
  claim_state: 'observed'
};

test('private sources require hashes', () => {
  assert.throws(() => scanAliasOccurrences(registry, [{ ...base, source_hash: undefined }]));
});

test('raw private text fields are rejected', () => {
  assert.throws(() => scanAliasOccurrences(registry, [{ ...base, excerpt: 'secret' }]));
});

test('same-dimension lifecycle conflicts are flagged', () => {
  const result = scanAliasOccurrences(registry, [
    base,
    { ...base, source_id: 'decision-1', source_kind: 'public', source_hash: undefined, lifecycle_status: 'retired' }
  ]);
  assert.equal(result.rows.every((row) => row.conflict), true);
});

test('different lifecycle dimensions may coexist without conflict', () => {
  const result = scanAliasOccurrences(registry, [
    base,
    {
      ...base,
      raw_value: 'Mirror Cartographer',
      source_id: 'state-1',
      source_kind: 'public',
      source_hash: undefined
    }
  ]);
  assert.deepEqual(result.rows.map((row) => row.conflict), [false, false]);
  assert.deepEqual(new Set(result.rows.map((row) => row.lifecycle_dimension)), new Set(['canonical_entity', 'contextual_alias']));
});

test('occurrence dimension override supports unresolved aliases', () => {
  const result = scanAliasOccurrences(registry, [{
    ...base,
    raw_value: 'M.C.',
    lifecycle_dimension: 'contextual_alias'
  }]);
  assert.equal(result.rows[0].lifecycle_dimension, 'contextual_alias');
  assert.equal(result.rows[0].entity_type, 'unresolved_alias');
});

test('digest is independent of occurrence order', () => {
  const second = { ...base, source_id: 'chat-2', source_hash: 'sha256:y' };
  assert.equal(
    scanAliasOccurrences(registry, [base, second]).digest_sha256,
    scanAliasOccurrences(registry, [second, base]).digest_sha256
  );
});
