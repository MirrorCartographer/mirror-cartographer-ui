export const PROJECTION_STATES = Object.freeze({
  PENDING: 'pending',
  DUPLICATED: 'duplicated',
  CONFLICTING: 'conflicting',
  SAFELY_PROMOTABLE: 'safely_promotable'
});

function parseTimestamp(value, field) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new TypeError(`${field} must be an ISO-8601 timestamp`);
  return time;
}

function normalizeSlice(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

export function validateQueueProjection(canonicalQueue, additiveUpdates) {
  if (!canonicalQueue || !Array.isArray(canonicalQueue.items)) {
    throw new TypeError('canonicalQueue.items must be an array');
  }
  if (!Array.isArray(additiveUpdates)) {
    throw new TypeError('additiveUpdates must be an array');
  }

  const canonicalTime = parseTimestamp(canonicalQueue.updated_at, 'canonicalQueue.updated_at');
  const items = new Map(canonicalQueue.items.map((item) => [item.id, item]));

  const results = additiveUpdates.map((update, index) => {
    const reasons = [];
    const item = items.get(update.queue_item);
    let state = PROJECTION_STATES.PENDING;

    if (!item) {
      state = PROJECTION_STATES.CONFLICTING;
      reasons.push('queue_item_missing_from_canonical');
    } else {
      if (update.owner !== item.owner) reasons.push('owner_mismatch');
      if (update.state && item.state === 'completed' && update.state !== 'completed') {
        reasons.push('state_regression');
      }

      const updateTime = parseTimestamp(update.recorded_at, `additiveUpdates[${index}].recorded_at`);
      const normalized = normalizeSlice(update.completed_slice);
      const completed = new Set((item.completed_slices ?? []).map(normalizeSlice));

      if (reasons.length) {
        state = PROJECTION_STATES.CONFLICTING;
      } else if (normalized && completed.has(normalized)) {
        state = PROJECTION_STATES.DUPLICATED;
        reasons.push('completed_slice_already_present');
      } else if (updateTime <= canonicalTime) {
        state = PROJECTION_STATES.CONFLICTING;
        reasons.push('additive_record_not_newer_than_canonical_snapshot');
      } else if (!normalized) {
        state = PROJECTION_STATES.CONFLICTING;
        reasons.push('completed_slice_missing');
      } else {
        state = PROJECTION_STATES.SAFELY_PROMOTABLE;
        reasons.push('newer_owner_consistent_nonduplicate_slice');
      }
    }

    return {
      queue_item: update.queue_item ?? null,
      recorded_at: update.recorded_at ?? null,
      state,
      reasons,
      canonical_updated_at: canonicalQueue.updated_at
    };
  });

  return {
    schema_version: 1,
    canonical_updated_at: canonicalQueue.updated_at,
    mutation_performed: false,
    summary: Object.values(PROJECTION_STATES).reduce((acc, key) => {
      acc[key] = results.filter((result) => result.state === key).length;
      return acc;
    }, {}),
    results
  };
}
