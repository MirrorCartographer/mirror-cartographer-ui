import test from 'node:test';
import assert from 'node:assert/strict';
import { partitionInclusiveWorkflowRunWindow, verifyInclusivePartition } from './workflow-run-window-partitioner-v2.mjs';

const sha = 'a'.repeat(40);

test('creates disjoint inclusive children with exact parent coverage', () => {
  const result = partitionInclusiveWorkflowRunWindow({ headSha: sha, start: '2026-07-15T00:00:00Z', end: '2026-07-15T00:00:09Z', totalCount: 1000 });
  assert.equal(result.classification, 'partition_required');
  assert.deepEqual(result.children.map(({ start, end }) => ({ start, end })), [
    { start: '2026-07-15T00:00:00Z', end: '2026-07-15T00:00:04Z' },
    { start: '2026-07-15T00:00:05Z', end: '2026-07-15T00:00:09Z' }
  ]);
  assert.deepEqual(verifyInclusivePartition({ start: '2026-07-15T00:00:00Z', end: '2026-07-15T00:00:09Z' }, result.children), { valid: true, reason: null });
});

test('fails closed when ceiling persists within one second', () => {
  const result = partitionInclusiveWorkflowRunWindow({ headSha: sha, start: '2026-07-15T00:00:00Z', end: '2026-07-15T00:00:00Z', totalCount: 1000 });
  assert.equal(result.classification, 'provider_ceiling_ambiguous');
});

test('rejects fractional-second boundaries', () => {
  assert.throws(() => partitionInclusiveWorkflowRunWindow({ headSha: sha, start: '2026-07-15T00:00:00.500Z', end: '2026-07-15T00:00:01Z', totalCount: 1000 }), /whole-second/);
});

test('detects overlapping inclusive children', () => {
  const assessment = verifyInclusivePartition(
    { start: '2026-07-15T00:00:00Z', end: '2026-07-15T00:00:09Z' },
    [
      { start: '2026-07-15T00:00:00Z', end: '2026-07-15T00:00:05Z' },
      { start: '2026-07-15T00:00:05Z', end: '2026-07-15T00:00:09Z' }
    ]
  );
  assert.deepEqual(assessment, { valid: false, reason: 'overlap_or_gap' });
});

test('accepts below-ceiling leaf but preserves pagination boundary', () => {
  const result = partitionInclusiveWorkflowRunWindow({ headSha: sha, start: '2026-07-15T00:00:00Z', end: '2026-07-15T00:00:01Z', totalCount: 999 });
  assert.equal(result.classification, 'enumerable');
  assert.match(result.claimBoundary, /pagination/);
});
