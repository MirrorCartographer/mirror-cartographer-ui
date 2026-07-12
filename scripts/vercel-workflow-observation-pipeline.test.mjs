import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateWorkflowQueryPipeline } from './vercel-workflow-observation-pipeline.mjs';

const commit = 'abc123';
const workflow = 'Vercel exact-commit evidence';
const expected = {
  commit_sha: commit,
  workflow_name: workflow,
  required_artifacts: ['vercel-audio-route-capability', 'vercel-exact-commit-manifest']
};

function successfulRun(overrides = {}) {
  return {
    id: 42,
    run_attempt: 1,
    html_url: 'https://github.com/example/repo/actions/runs/42',
    head_sha: commit,
    name: workflow,
    status: 'completed',
    conclusion: 'success',
    created_at: '2026-07-12T19:00:00Z',
    updated_at: '2026-07-12T19:01:00Z',
    ...overrides
  };
}

test('holds at query stage when the expected commit is unobserved', () => {
  const result = evaluateWorkflowQueryPipeline({
    query_result: { workflow_runs: [] },
    observed_at: '2026-07-12T19:02:00Z',
    artifacts: []
  }, expected);
  assert.equal(result.accepted, false);
  assert.equal(result.stage, 'query');
  assert.equal(result.decision, 'hold_unobserved');
});

test('holds at observation stage when required artifacts are missing', () => {
  const result = evaluateWorkflowQueryPipeline({
    query_result: { workflow_runs: [successfulRun()] },
    observed_at: '2026-07-12T19:02:00Z',
    artifacts: [{ name: 'vercel-exact-commit-manifest' }]
  }, expected);
  assert.equal(result.accepted, false);
  assert.equal(result.stage, 'observation');
  assert.equal(result.decision, 'hold_missing_artifacts');
});

test('rejects provider success when immutable run identity is incomplete', () => {
  const result = evaluateWorkflowQueryPipeline({
    query_result: { workflow_runs: [successfulRun({ html_url: null })] },
    observed_at: '2026-07-12T19:02:00Z',
    artifacts: expected.required_artifacts
  }, expected);
  assert.equal(result.accepted, false);
  assert.equal(result.stage, 'observation');
  assert.equal(result.decision, 'hold_unbound_run');
});

test('selects the newest matching run before observation evaluation', () => {
  const result = evaluateWorkflowQueryPipeline({
    query_result: {
      workflow_runs: [
        successfulRun({ id: 41, conclusion: 'failure', updated_at: '2026-07-12T19:00:30Z' }),
        successfulRun({ id: 42, updated_at: '2026-07-12T19:01:30Z' })
      ]
    },
    observed_at: '2026-07-12T19:02:00Z',
    artifacts: expected.required_artifacts.map((name) => ({ name }))
  }, expected);
  assert.equal(result.accepted, true);
  assert.equal(result.observation.run_id, 42);
});

test('accepts only exact-commit successful evidence with required artifacts', () => {
  const result = evaluateWorkflowQueryPipeline({
    query_result: { workflow_runs: [successfulRun()] },
    observed_at: '2026-07-12T19:02:00Z',
    artifacts: expected.required_artifacts
  }, expected);
  assert.equal(result.accepted, true);
  assert.equal(result.stage, 'accepted');
  assert.equal(result.observation.head_sha, commit);
  assert.deepEqual(result.observation.artifacts, [...expected.required_artifacts].sort());
});
