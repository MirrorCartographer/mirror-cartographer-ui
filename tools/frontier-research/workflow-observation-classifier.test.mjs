import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyWorkflowObservation } from './workflow-observation-classifier.mjs';

const sha = 'd63775e1f4ec5dd88941c9cc49857f5621a7596d';
const workflow = 'Frontier Audio Session Evidence';

function completeQuery(overrides = {}) {
  return {
    headSha: sha,
    coveredEvents: ['push', 'workflow_dispatch'],
    paginationComplete: true,
    ...overrides,
  };
}

test('accepts a successful exact workflow/head/event match', () => {
  const result = classifyWorkflowObservation({
    expectedHeadSha: sha,
    expectedWorkflow: workflow,
    expectedEvents: ['push', 'workflow_dispatch'],
    query: completeQuery(),
    runs: [{ id: 7, name: workflow, event: 'push', head_sha: sha, status: 'completed', conclusion: 'success' }],
  });
  assert.equal(result.classification, 'matching_run_observed');
  assert.equal(result.runtimeVerified, true);
});

test('does not call an in-progress exact match runtime verified', () => {
  const result = classifyWorkflowObservation({
    expectedHeadSha: sha,
    expectedWorkflow: workflow,
    expectedEvents: ['push'],
    query: completeQuery({ coveredEvents: ['push'] }),
    runs: [{ name: workflow, event: 'push', head_sha: sha, status: 'in_progress', conclusion: null }],
  });
  assert.equal(result.classification, 'matching_run_observed');
  assert.equal(result.runtimeVerified, false);
});

test('empty pull-request-only observation is inconclusive for a push workflow', () => {
  const result = classifyWorkflowObservation({
    expectedHeadSha: sha,
    expectedWorkflow: workflow,
    expectedEvents: ['push'],
    query: { headSha: sha, coveredEvents: ['pull_request'], paginationComplete: true },
    runs: [],
  });
  assert.equal(result.classification, 'observation_inconclusive');
  assert.deepEqual(result.reasons, ['missing_event_coverage:push']);
});

test('incomplete pagination is inconclusive even with event and SHA coverage', () => {
  const result = classifyWorkflowObservation({
    expectedHeadSha: sha,
    expectedWorkflow: workflow,
    expectedEvents: ['push'],
    query: { headSha: sha, coveredEvents: ['push'], paginationComplete: false },
    runs: [],
  });
  assert.equal(result.classification, 'observation_inconclusive');
  assert.ok(result.reasons.includes('pagination_incomplete'));
});

test('only complete event, SHA, and pagination scope can classify no matching run', () => {
  const result = classifyWorkflowObservation({
    expectedHeadSha: sha,
    expectedWorkflow: workflow,
    expectedEvents: ['push'],
    query: completeQuery({ coveredEvents: ['push'] }),
    runs: [{ name: workflow, event: 'push', head_sha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', status: 'completed', conclusion: 'success' }],
  });
  assert.equal(result.classification, 'no_matching_run_observed_with_complete_scope');
  assert.equal(result.runtimeVerified, false);
  assert.equal(result.conflictingRuns.length, 1);
});
