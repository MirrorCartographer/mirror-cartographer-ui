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

function validArtifacts(runId = 42) {
  return expected.required_artifacts.map((name, index) => ({
    id: 100 + index,
    name,
    expired: false,
    workflow_run: { id: runId }
  }));
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

test('holds at artifact manifest stage when a required artifact is missing', () => {
  const result = evaluateWorkflowQueryPipeline({
    query_result: { workflow_runs: [successfulRun()] },
    observed_at: '2026-07-12T19:02:00Z',
    artifacts: validArtifacts().slice(0, 1)
  }, expected);
  assert.equal(result.accepted, false);
  assert.equal(result.stage, 'artifact_manifest');
  assert.equal(result.decision, 'required_artifact_missing');
});

test('rejects an artifact bound to a different workflow run', () => {
  const result = evaluateWorkflowQueryPipeline({
    query_result: { workflow_runs: [successfulRun()] },
    observed_at: '2026-07-12T19:02:00Z',
    artifacts: validArtifacts(41)
  }, expected);
  assert.equal(result.accepted, false);
  assert.equal(result.stage, 'artifact_manifest');
  assert.equal(result.decision, 'artifact_run_mismatch');
});

test('rejects an expired artifact before observation acceptance', () => {
  const artifacts = validArtifacts();
  artifacts[0].expired = true;
  const result = evaluateWorkflowQueryPipeline({
    query_result: { workflow_runs: [successfulRun()] },
    observed_at: '2026-07-12T19:02:00Z',
    artifacts
  }, expected);
  assert.equal(result.accepted, false);
  assert.equal(result.stage, 'artifact_manifest');
  assert.equal(result.decision, 'artifact_expired');
});

test('rejects duplicate artifact names before observation acceptance', () => {
  const artifacts = validArtifacts();
  artifacts.push({ id: 999, name: expected.required_artifacts[0], expired: false, workflow_run: { id: 42 } });
  const result = evaluateWorkflowQueryPipeline({
    query_result: { workflow_runs: [successfulRun()] },
    observed_at: '2026-07-12T19:02:00Z',
    artifacts
  }, expected);
  assert.equal(result.accepted, false);
  assert.equal(result.stage, 'artifact_manifest');
  assert.equal(result.decision, 'artifact_name_ambiguous');
});

test('rejects provider success when immutable run identity is incomplete', () => {
  const result = evaluateWorkflowQueryPipeline({
    query_result: { workflow_runs: [successfulRun({ html_url: null })] },
    observed_at: '2026-07-12T19:02:00Z',
    artifacts: validArtifacts()
  }, expected);
  assert.equal(result.accepted, false);
  assert.equal(result.stage, 'observation');
  assert.equal(result.decision, 'hold_unbound_run');
});

test('selects the newest matching run before artifact and observation evaluation', () => {
  const result = evaluateWorkflowQueryPipeline({
    query_result: {
      workflow_runs: [
        successfulRun({ id: 41, conclusion: 'failure', updated_at: '2026-07-12T19:00:30Z' }),
        successfulRun({ id: 42, updated_at: '2026-07-12T19:01:30Z' })
      ]
    },
    observed_at: '2026-07-12T19:02:00Z',
    artifacts: validArtifacts(42)
  }, expected);
  assert.equal(result.accepted, true);
  assert.equal(result.observation.run_id, 42);
  assert.equal(result.artifact_manifest.run_id, 42);
});

test('accepts only exact-commit successful evidence with a verified artifact manifest', () => {
  const result = evaluateWorkflowQueryPipeline({
    query_result: { workflow_runs: [successfulRun()] },
    observed_at: '2026-07-12T19:02:00Z',
    artifacts: validArtifacts()
  }, expected);
  assert.equal(result.accepted, true);
  assert.equal(result.stage, 'accepted');
  assert.equal(result.artifact_manifest.decision, 'artifact_manifest_verified');
  assert.equal(result.observation.head_sha, commit);
  assert.deepEqual(result.observation.artifacts, [...expected.required_artifacts].sort());
});
