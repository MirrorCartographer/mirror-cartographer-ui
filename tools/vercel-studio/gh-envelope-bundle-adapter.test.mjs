import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorkflowEvidenceBundleFromGhPages } from './gh-envelope-bundle-adapter.mjs';

const commitSha = 'a'.repeat(40);
const run = {
  id: 41,
  head_sha: commitSha,
  event: 'push',
  status: 'completed',
  conclusion: 'success',
  workflow_id: 8,
  run_attempt: 1
};
const primary = { complete: true, commitSha, runs: [run] };
const primarySource = {
  method: 'repository_api_link_pagination',
  retrieved_at: '2026-07-12T23:30:00Z',
  pages_fetched: 1
};
const base = {
  commitSha,
  primary,
  primarySource,
  ghPages: [{ total_count: 1, workflow_runs: [run] }],
  ghCommand: 'gh api repos/o/r/actions/runs -f head_sha=abc --paginate --slurp',
  ghRetrievedAt: '2026-07-12T23:31:00Z',
  generatedAt: '2026-07-12T23:32:00Z'
};

test('builds a verified bundle only after the gh envelope validates and reconciles', () => {
  const result = buildWorkflowEvidenceBundleFromGhPages(base);
  assert.equal(result.verified, true);
  assert.equal(result.sources.independent.pages_fetched, 1);
  assert.deepEqual(result.independent_envelope.command_contract, { paginate: true, slurp: true });
});

test('rejects a non-exhaustive gh command before bundle construction', () => {
  const result = buildWorkflowEvidenceBundleFromGhPages({ ...base, ghCommand: 'gh api repos/o/r/actions/runs' });
  assert.equal(result.verified, false);
  assert.equal(result.reconciliation.reason, 'independent_non_exhaustive_command_contract');
});

test('rejects provider-ceiling ambiguity before reconciliation', () => {
  const result = buildWorkflowEvidenceBundleFromGhPages({
    ...base,
    ghPages: [{ total_count: 1000, workflow_runs: [run] }]
  });
  assert.equal(result.verified, false);
  assert.equal(result.reconciliation.reason, 'independent_provider_ceiling_ambiguity');
});

test('rejects count mismatch before reconciliation', () => {
  const result = buildWorkflowEvidenceBundleFromGhPages({
    ...base,
    ghPages: [{ total_count: 2, workflow_runs: [run] }]
  });
  assert.equal(result.verified, false);
  assert.equal(result.reconciliation.reason, 'independent_pagination_count_mismatch');
});

test('retains divergence from the primary enumeration as rejected evidence', () => {
  const result = buildWorkflowEvidenceBundleFromGhPages({
    ...base,
    primary: { complete: true, commitSha, runs: [{ ...run, conclusion: 'failure' }] }
  });
  assert.equal(result.verified, false);
  assert.equal(result.reconciliation.reason, 'enumeration_divergence');
});
