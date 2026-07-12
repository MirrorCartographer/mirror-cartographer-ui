const REQUIRED_FIELDS = [
  'occurrence_id', 'raw_value', 'normalized_value', 'entity_type',
  'lifecycle_dimension', 'lifecycle_status', 'claim_status', 'confidence',
  'source_reference', 'source_visibility', 'observed_at_or_range',
  'evidence_strength', 'review_state'
];

const ENUMS = {
  claim_status: new Set(['observed', 'inferred', 'proposed', 'superseded', 'unresolved']),
  confidence: new Set(['high', 'medium', 'low']),
  source_visibility: new Set(['public_repository', 'private_file_library', 'private_chat_history', 'derived_artifact']),
  evidence_strength: new Set(['direct_source', 'corroborated_summary', 'deterministic_derivation', 'weak_context']),
  review_state: new Set(['accepted', 'needs_review', 'conflict', 'superseded', 'privacy_blocked'])
};

const PRIVATE_PASSAGE_MARKERS = [/\n/, /\r/, /[.!?]\s+[A-Z]/, /\b(message|body|excerpt|quote|raw_text)\s*[:=]/i];

export function validateOccurrence(row, index = 0) {
  const errors = [];
  if (!row || typeof row !== 'object' || Array.isArray(row)) return [`occurrence ${index} must be an object`];

  for (const field of REQUIRED_FIELDS) {
    if (row[field] === undefined || row[field] === null || row[field] === '') errors.push(`occurrence ${index} missing ${field}`);
  }
  for (const [field, allowed] of Object.entries(ENUMS)) {
    if (row[field] !== undefined && !allowed.has(row[field])) errors.push(`occurrence ${index} has invalid ${field}`);
  }
  if (typeof row.occurrence_id === 'string' && (/\s/.test(row.occurrence_id) || row.occurrence_id.length > 96)) {
    errors.push(`occurrence ${index} occurrence_id must be opaque and compact`);
  }
  if (typeof row.source_reference === 'string' && PRIVATE_PASSAGE_MARKERS.some((pattern) => pattern.test(row.source_reference))) {
    errors.push(`occurrence ${index} source_reference appears to contain copied passage content`);
  }
  if (row.evidence_strength === 'weak_context' && row.review_state === 'accepted') {
    errors.push(`occurrence ${index} weak_context cannot be accepted`);
  }
  if (row.claim_status === 'unresolved' && row.review_state === 'accepted') {
    errors.push(`occurrence ${index} unresolved claim cannot be accepted`);
  }
  if (row.lifecycle_dimension === 'unresolved_dimension' && row.review_state !== 'needs_review' && row.review_state !== 'privacy_blocked') {
    errors.push(`occurrence ${index} unresolved dimension requires review`);
  }
  return errors;
}

export function validateOccurrenceSet(input) {
  const rows = Array.isArray(input) ? input : input?.rows;
  const errors = [];
  if (!Array.isArray(rows)) return { valid: false, errors: ['rows must be an array'], rows: [] };

  rows.forEach((row, index) => errors.push(...validateOccurrence(row, index)));

  const groups = new Map();
  rows.forEach((row, index) => {
    if (!row || typeof row !== 'object') return;
    const key = `${row.normalized_value}\u0000${row.lifecycle_dimension}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ row, index });
  });

  for (const group of groups.values()) {
    const statuses = new Set(group.map(({ row }) => row.lifecycle_status));
    if (statuses.size > 1) {
      for (const { row, index } of group) {
        if (row.review_state !== 'conflict') errors.push(`occurrence ${index} lifecycle conflict must use review_state=conflict`);
      }
    }
  }

  return { valid: errors.length === 0, errors, rows };
}
