import assert from 'node:assert/strict';
import { validateVercelWorkflowPageChain } from './validate-vercel-workflow-page-chain.mjs';

const sha = 'a'.repeat(40);
const repository = 'MirrorCartographer/mirror-cartographer-ui';
const continuation = (page, extra = '') =>
  `https://api.github.com/repos/${repository}/actions/runs?page=${page}&head_sha=${sha}&per_page=100${extra}`;

const valid = [
  {
    page: 1,
    workflow_runs: [{ id: 1, head_sha: sha }],
    next_url: continuation(2)
  },
  {
    page: 2,
    workflow_runs: [{ id: 2, head_sha: sha }],
    next_url: null
  }
];

assert.equal(validateVercelWorkflowPageChain({ repository, commit_sha: sha, pages: valid }).verified, true);
assert.equal(validateVercelWorkflowPageChain({ repository, commit_sha: sha, pages: [] }).reason, 'pages_required');
assert.equal(
  validateVercelWorkflowPageChain({
    repository,
    commit_sha: sha,
    pages: [{ ...valid[0], next_url: continuation(3) }, valid[1]]
  }).reason,
  'invalid_continuation_url'
);
assert.equal(
  validateVercelWorkflowPageChain({
    repository,
    commit_sha: sha,
    pages: [valid[0], { ...valid[1], workflow_runs: [{ id: 1, head_sha: sha }] }]
  }).reason,
  'duplicate_or_invalid_run_id'
);
assert.equal(
  validateVercelWorkflowPageChain({
    repository,
    commit_sha: sha,
    pages: [{ ...valid[0], workflow_runs: [{ id: 1, head_sha: 'b'.repeat(40) }] }, valid[1]]
  }).reason,
  'cross_commit_record'
);
assert.equal(
  validateVercelWorkflowPageChain({
    repository,
    commit_sha: sha,
    pages: [{ ...valid[0], next_url: continuation(2, '&event=push') }, valid[1]]
  }).reason,
  'invalid_continuation_url'
);
assert.equal(
  validateVercelWorkflowPageChain({
    repository,
    commit_sha: sha,
    pages: [{ page: 1, workflow_runs: [], next_url: continuation(2) }]
  }).reason,
  'terminal_page_has_continuation'
);

console.log('7 passed, 0 failed');
