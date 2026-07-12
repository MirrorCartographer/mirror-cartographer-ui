import test from 'node:test';
import assert from 'node:assert/strict';

import { scanAliasOccurrences } from '../scripts/continuity-alias-occurrence-scanner.mjs';
import { normalizeScannerOutput } from '../scripts/continuity-alias-occurrence-adapter.mjs';
import { validateOccurrenceSet } from '../scripts/continuity-alias-occurrence-validator.mjs';

const registry = {
  aliases: [
    {
      raw_value: 'MC',
      normalized_value: 'Mirror Cartographer',
      type: 'abbreviation',
      lifecycle_dimension: 'contextual_alias',
      status: 'active',
      confidence: 'high'
    }
  ]
};

function runPipeline(occurrences) {
  const scanned = scanAliasOccurrences(registry, occurrences);
  const normalized = normalizeScannerOutput(scanned);
  const validation = validateOccurrenceSet(normalized);
  return { scanned, normalized, validation };
}

test('public observed alias survives scan-normalize-validate without semantic drift', () => {
  const result = runPipeline([
    {
      raw_value: 'MC',
      source_id: 'repo:docs/project-language.md#mc',
      source_kind: 'public',
      observed_at: '2026-07-12',
      claim_state: 'observed'
    }
  ]);

  assert.equal(result.scanned.schema_version, 2);
  assert.match(result.scanned.digest_sha256, /^[a-f0-9]{64}$/);
  assert.equal(result.normalized.rows.length, 1);
  assert.deepEqual(
    {
      normalized_value: result.normalized.rows[0].normalized_value,
      lifecycle_dimension: result.normalized.rows[0].lifecycle_dimension,
      lifecycle_status: result.normalized.rows[0].lifecycle_status,
      claim_status: result.normalized.rows[0].claim_status,
      source_visibility: result.normalized.rows[0].source_visibility,
      evidence_strength: result.normalized.rows[0].evidence_strength,
      review_state: result.normalized.rows[0].review_state
    },
    {
      normalized_value: 'Mirror Cartographer',
      lifecycle_dimension: 'contextual_alias',
      lifecycle_status: 'active',
      claim_status: 'observed',
      source_visibility: 'public_repository',
      evidence_strength: 'direct_source',
      review_state: 'accepted'
    }
  );
  assert.equal(result.validation.valid, true, result.validation.errors.join('\n'));
});

test('private source remains summarized and requires a hash', () => {
  assert.throws(
    () => runPipeline([
      {
        raw_value: 'MC',
        source_id: 'private-chat-summary:mc-001',
        source_kind: 'private',
        observed_at: '2026-07-12',
        claim_state: 'inferred'
      }
    ]),
    /private source requires source_hash/
  );

  const result = runPipeline([
    {
      raw_value: 'MC',
      source_id: 'private-chat-summary:mc-001',
      source_kind: 'private',
      source_hash: 'sha256:9a7c',
      observed_at: '2026-07-12',
      claim_state: 'inferred'
    }
  ]);

  assert.equal(result.normalized.rows[0].source_visibility, 'private_chat_history');
  assert.equal(result.normalized.rows[0].evidence_strength, 'corroborated_summary');
  assert.equal(result.validation.valid, true, result.validation.errors.join('\n'));
});

test('conflicting lifecycle statuses remain conflicts after normalization', () => {
  const result = runPipeline([
    {
      raw_value: 'MC',
      source_id: 'repo:decision-log#active',
      source_kind: 'public',
      observed_at: '2026-07-11',
      claim_state: 'observed',
      lifecycle_status: 'active'
    },
    {
      raw_value: 'MC',
      source_id: 'repo:decision-log#retired',
      source_kind: 'public',
      observed_at: '2026-07-12',
      claim_state: 'observed',
      lifecycle_status: 'retired'
    }
  ]);

  assert.equal(result.scanned.rows.every((row) => row.conflict), true);
  assert.equal(result.normalized.rows.every((row) => row.review_state === 'conflict'), true);
  assert.equal(result.validation.valid, true, result.validation.errors.join('\n'));
});

test('raw private passage fields are rejected before persistence', () => {
  assert.throws(
    () => runPipeline([
      {
        raw_value: 'MC',
        source_id: 'private-chat-summary:mc-002',
        source_kind: 'private',
        source_hash: 'sha256:2f31',
        observed_at: '2026-07-12',
        claim_state: 'observed',
        message: 'private text must not enter the continuity artifact'
      }
    ]),
    /forbidden private field: message/
  );
});
