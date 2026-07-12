import { createHash } from 'node:crypto';

const SOURCE_VISIBILITY = new Map([
  ['public', 'public_repository'],
  ['private', 'private_chat_history'],
  ['derived', 'derived_artifact'],
  ['file_library', 'private_file_library']
]);

function occurrenceId(row) {
  const canonical = JSON.stringify([
    row.raw_value,
    row.normalized_value,
    row.lifecycle_dimension,
    row.lifecycle_status,
    row.source?.id,
    row.observed_at
  ]);
  return `occ-${createHash('sha256').update(canonical).digest('hex').slice(0, 24)}`;
}

function sourceVisibility(row) {
  return SOURCE_VISIBILITY.get(row.source?.kind) ?? 'derived_artifact';
}

function evidenceStrength(row) {
  if (row.source?.kind === 'public') return 'direct_source';
  if (row.source?.kind === 'private' && row.source?.hash) return 'corroborated_summary';
  if (row.source?.kind === 'derived') return 'deterministic_derivation';
  return 'weak_context';
}

function reviewState(row) {
  if (row.conflict) return 'conflict';
  if (row.lifecycle_dimension === 'unresolved_dimension') return 'needs_review';
  if (row.claim_state === 'superseded') return 'superseded';
  if (row.claim_state === 'unresolved') return 'needs_review';
  if (evidenceStrength(row) === 'weak_context') return 'needs_review';
  return 'accepted';
}

export function normalizeScannerRow(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('scanner row must be an object');
  return {
    occurrence_id: occurrenceId(row),
    raw_value: row.raw_value,
    normalized_value: row.normalized_value,
    entity_type: row.entity_type,
    lifecycle_dimension: row.lifecycle_dimension,
    lifecycle_status: row.lifecycle_status,
    claim_status: row.claim_state,
    confidence: row.confidence,
    source_reference: row.source?.id,
    source_visibility: sourceVisibility(row),
    observed_at_or_range: row.observed_at,
    evidence_strength: evidenceStrength(row),
    review_state: reviewState(row)
  };
}

export function normalizeScannerOutput(input) {
  if (!input || input.schema_version !== 2 || !Array.isArray(input.rows)) {
    throw new Error('scanner output must be schema_version 2 with rows');
  }
  return {
    schema_version: 2,
    rows: input.rows.map(normalizeScannerRow)
  };
}
