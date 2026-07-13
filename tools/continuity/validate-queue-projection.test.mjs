import assert from 'node:assert/strict';
import { validateQueueProjection, PROJECTION_STATES } from './validate-queue-projection.mjs';

const canonical = {
  updated_at: '2026-07-13T00:49:00Z',
  items: [{
    id: 'M-RECONCILE-002',
    owner: 'continuity_mining',
    state: 'in_progress',
    completed_slices: ['Existing durable slice.']
  }]
};

const updates = [
  {
    queue_item: 'M-RECONCILE-002', owner: 'continuity_mining',
    recorded_at: '2026-07-13T22:09:34Z', completed_slice: 'New durable slice.'
  },
  {
    queue_item: 'M-RECONCILE-002', owner: 'continuity_mining',
    recorded_at: '2026-07-13T22:10:00Z', completed_slice: ' Existing   durable slice. '
  },
  {
    queue_item: 'M-RECONCILE-002', owner: 'frontier_research',
    recorded_at: '2026-07-13T22:11:00Z', completed_slice: 'Wrong owner.'
  },
  {
    queue_item: 'UNKNOWN', owner: 'continuity_mining',
    recorded_at: '2026-07-13T22:12:00Z', completed_slice: 'Unknown item.'
  },
  {
    queue_item: 'M-RECONCILE-002', owner: 'continuity_mining',
    recorded_at: '2026-07-12T22:12:00Z', completed_slice: 'Older record.'
  },
  {
    queue_item: 'M-RECONCILE-002', owner: 'continuity_mining',
    recorded_at: '2026-07-13T22:13:00Z', completed_slice: '   '
  }
];

const report = validateQueueProjection(canonical, updates);
assert.equal(report.mutation_performed, false);
assert.deepEqual(report.results.map((result) => result.state), [
  PROJECTION_STATES.SAFELY_PROMOTABLE,
  PROJECTION_STATES.DUPLICATED,
  PROJECTION_STATES.CONFLICTING,
  PROJECTION_STATES.CONFLICTING,
  PROJECTION_STATES.CONFLICTING,
  PROJECTION_STATES.CONFLICTING
]);
assert.deepEqual(report.summary, {
  pending: 0,
  duplicated: 1,
  conflicting: 4,
  safely_promotable: 1
});
assert.ok(report.results[2].reasons.includes('owner_mismatch'));
assert.ok(report.results[3].reasons.includes('queue_item_missing_from_canonical'));
assert.ok(report.results[4].reasons.includes('additive_record_not_newer_than_canonical_snapshot'));
assert.ok(report.results[5].reasons.includes('completed_slice_missing'));

assert.throws(
  () => validateQueueProjection({ updated_at: 'invalid', items: [] }, []),
  /ISO-8601/
);

console.log('queue projection validator: 8 assertions passed');
