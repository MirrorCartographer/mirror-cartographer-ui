import test from 'node:test';
import assert from 'node:assert/strict';
import { partitionWorkflowRunWindow, assessPartitionTree } from './workflow-run-window-partitioner.mjs';

const base = { headSha: 'a'.repeat(40), start: '2026-07-01T00:00:00.000Z', end: '2026-07-02T00:00:00.000Z' };

test('accepts a window strictly below the documented ceiling', () => {
  const result = partitionWorkflowRunWindow({ ...base, totalCount: 999 });
  assert.equal(result.classification, 'enumerable');
  assert.deepEqual(assessPartitionTree(result), { exhaustive: true, reason: null });
});

test('requires deterministic bisection at the ceiling', () => {
  const result = partitionWorkflowRunWindow({ ...base, totalCount: 1000 });
  assert.equal(result.classification, 'partition_required');
  assert.equal(result.children.length, 2);
  assert.equal(result.children[0].end, result.children[1].start);
});

test('fails closed when the ceiling persists at minimum granularity', () => {
  const result = partitionWorkflowRunWindow({
    headSha: 'b'.repeat(40),
    start: '2026-07-01T00:00:00.000Z',
    end: '2026-07-01T00:00:01.000Z',
    totalCount: 1000
  });
  assert.equal(result.classification, 'provider_ceiling_ambiguous');
  assert.deepEqual(assessPartitionTree(result), { exhaustive: false, reason: 'provider_ceiling_ambiguous' });
});

test('rejects malformed identity and time bounds', () => {
  assert.throws(() => partitionWorkflowRunWindow({ ...base, headSha: 'bad', totalCount: 1 }), /40-character/);
  assert.throws(() => partitionWorkflowRunWindow({ ...base, start: base.end, totalCount: 1 }), /precede/);
});

test('requires every partition leaf to be independently resolved', () => {
  const root = partitionWorkflowRunWindow({ ...base, totalCount: 1000 });
  root.children = [
    partitionWorkflowRunWindow({ ...root.children[0], totalCount: 20 }),
    partitionWorkflowRunWindow({ ...root.children[1], totalCount: 1000 }, { minimumWindowMs: 43200000 })
  ];
  assert.deepEqual(assessPartitionTree(root), { exhaustive: false, reason: 'provider_ceiling_ambiguous' });
});
