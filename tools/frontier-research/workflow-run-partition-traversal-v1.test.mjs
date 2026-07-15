import test from 'node:test';
import assert from 'node:assert/strict';
import { planWorkflowRunPartitionTraversal } from './workflow-run-partition-traversal-v1.mjs';

const sha = 'a'.repeat(40);
const root = { headSha: sha, start: '2026-07-15T00:00:00Z', end: '2026-07-15T00:00:03Z' };

test('requests observation before making a coverage claim', () => {
  const result = planWorkflowRunPartitionTraversal(root, {});
  assert.equal(result.verified, false);
  assert.deepEqual(result.failClosedReasons, ['observation_missing']);
});

test('recursively partitions saturated windows into disjoint paginated leaves', () => {
  const observations = {
    '2026-07-15T00:00:00Z..2026-07-15T00:00:03Z': { start: '2026-07-15T00:00:00Z', end: '2026-07-15T00:00:03Z', totalCount: 1000 },
    '2026-07-15T00:00:00Z..2026-07-15T00:00:01Z': { start: '2026-07-15T00:00:00Z', end: '2026-07-15T00:00:01Z', totalCount: 8, paginationComplete: true },
    '2026-07-15T00:00:02Z..2026-07-15T00:00:03Z': { start: '2026-07-15T00:00:02Z', end: '2026-07-15T00:00:03Z', totalCount: 5, paginationComplete: true }
  };
  const result = planWorkflowRunPartitionTraversal(root, observations);
  assert.equal(result.verified, true);
  assert.equal(result.partitions.length, 1);
  assert.deepEqual(result.leaves.map(({ start, end }) => [start, end]), [
    ['2026-07-15T00:00:00Z', '2026-07-15T00:00:01Z'],
    ['2026-07-15T00:00:02Z', '2026-07-15T00:00:03Z']
  ]);
});

test('fails closed when a saturated one-second leaf cannot be subdivided', () => {
  const one = { headSha: sha, start: '2026-07-15T00:00:00Z', end: '2026-07-15T00:00:00Z' };
  const observations = {
    '2026-07-15T00:00:00Z..2026-07-15T00:00:00Z': { start: one.start, end: one.end, totalCount: 1000 }
  };
  const result = planWorkflowRunPartitionTraversal(one, observations);
  assert.equal(result.verified, false);
  assert.deepEqual(result.failClosedReasons, ['provider_ceiling_ambiguous']);
});

test('requires complete pagination on every below-ceiling leaf', () => {
  const observations = {
    '2026-07-15T00:00:00Z..2026-07-15T00:00:03Z': { start: root.start, end: root.end, totalCount: 9, paginationComplete: false }
  };
  const result = planWorkflowRunPartitionTraversal(root, observations);
  assert.equal(result.verified, false);
  assert.deepEqual(result.failClosedReasons, ['pagination_incomplete']);
});

test('rejects observations attached to the wrong interval', () => {
  const observations = {
    '2026-07-15T00:00:00Z..2026-07-15T00:00:03Z': { start: root.start, end: '2026-07-15T00:00:02Z', totalCount: 1 }
  };
  assert.throws(() => planWorkflowRunPartitionTraversal(root, observations), /observation_window_mismatch/);
});
