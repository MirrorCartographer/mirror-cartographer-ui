import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGhPaginatedWorkflowEnvelope } from './gh-workflow-run-envelope.mjs';

const sha = 'a'.repeat(40);
const command = `gh api --method GET repos/{owner}/{repo}/actions/runs -f head_sha=${sha} -F per_page=100 --paginate --slurp`;
const run = id => ({ id, head_sha: sha, event: 'push', status: 'completed', conclusion: 'success', workflow_id: 7, run_attempt: 1 });

test('accepts a complete slurped traversal', () => {
  const result = buildGhPaginatedWorkflowEnvelope({ pages: [{ total_count: 2, workflow_runs: [run(2), run(1)] }], commitSha: sha, command });
  assert.equal(result.complete, true);
  assert.deepEqual(result.runs.map(x => x.id), [1, 2]);
});

test('rejects command without paginate and slurp', () => {
  const result = buildGhPaginatedWorkflowEnvelope({ pages: [{ total_count: 0, workflow_runs: [] }], commitSha: sha, command: 'gh api repos/x/y/actions/runs' });
  assert.equal(result.reason, 'non_exhaustive_command_contract');
});

test('rejects a count mismatch', () => {
  const result = buildGhPaginatedWorkflowEnvelope({ pages: [{ total_count: 2, workflow_runs: [run(1)] }], commitSha: sha, command });
  assert.equal(result.reason, 'pagination_count_mismatch');
});

test('rejects provider ceiling ambiguity', () => {
  const result = buildGhPaginatedWorkflowEnvelope({ pages: [{ total_count: 1000, workflow_runs: [] }], commitSha: sha, command });
  assert.equal(result.reason, 'provider_ceiling_ambiguity');
});

test('rejects cross-commit and duplicate records', () => {
  const cross = buildGhPaginatedWorkflowEnvelope({ pages: [{ total_count: 1, workflow_runs: [{ ...run(1), head_sha: 'b'.repeat(40) }] }], commitSha: sha, command });
  assert.equal(cross.reason, 'cross_commit_record');
  const duplicate = buildGhPaginatedWorkflowEnvelope({ pages: [{ total_count: 2, workflow_runs: [run(1), run(1)] }], commitSha: sha, command });
  assert.equal(duplicate.reason, 'duplicate_run_id');
});

test('rejects changing total_count across pages', () => {
  const result = buildGhPaginatedWorkflowEnvelope({ pages: [{ total_count: 1, workflow_runs: [run(1)] }, { total_count: 2, workflow_runs: [] }], commitSha: sha, command });
  assert.equal(result.reason, 'total_count_changed_during_traversal');
});
