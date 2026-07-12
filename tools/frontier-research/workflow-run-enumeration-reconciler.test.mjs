import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileWorkflowEnumerations } from './workflow-run-enumeration-reconciler.mjs';

const sha = 'a'.repeat(40);
const run = (id, extra = {}) => ({
  id,
  head_sha: sha,
  event: 'push',
  status: 'completed',
  conclusion: 'success',
  workflow_id: 7,
  run_attempt: 1,
  ...extra
});
const result = runs => ({ complete: true, commitSha: sha, runs });

test('accepts equal independently complete enumerations regardless of order', () => {
  const out = reconcileWorkflowEnumerations({
    primary: result([run(2), run(1)]),
    independent: result([run(1), run(2)]),
    commitSha: sha
  });
  assert.deepEqual(out, {
    verified: true,
    reason: 'independent_enumerations_match',
    commitSha: sha,
    runCount: 2,
    runIds: [1, 2]
  });
});

test('fails closed when either enumeration is incomplete', () => {
  const out = reconcileWorkflowEnumerations({
    primary: { complete: false, commitSha: sha, runs: [] },
    independent: result([]),
    commitSha: sha
  });
  assert.equal(out.reason, 'primary_incomplete');
});

test('detects missing run ids in either source', () => {
  const out = reconcileWorkflowEnumerations({
    primary: result([run(1), run(2)]),
    independent: result([run(2), run(3)]),
    commitSha: sha
  });
  assert.equal(out.reason, 'enumeration_divergence');
  assert.deepEqual(out.onlyPrimary, [1]);
  assert.deepEqual(out.onlyIndependent, [3]);
});

test('detects metadata disagreement for the same run', () => {
  const out = reconcileWorkflowEnumerations({
    primary: result([run(1)]),
    independent: result([run(1, { conclusion: 'failure' })]),
    commitSha: sha
  });
  assert.equal(out.fieldMismatches[0].field, 'conclusion');
});

test('rejects cross-commit records and duplicate ids', () => {
  let out = reconcileWorkflowEnumerations({
    primary: result([run(1, { head_sha: 'b'.repeat(40) })]),
    independent: result([]),
    commitSha: sha
  });
  assert.equal(out.reason, 'primary_cross_commit_record');

  out = reconcileWorkflowEnumerations({
    primary: result([run(1), run(1)]),
    independent: result([run(1)]),
    commitSha: sha
  });
  assert.equal(out.reason, 'primary_duplicate_run_id');
});
