import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeGitHubArtifactListResponse } from './vercel-github-artifact-list-adapter.mjs';

const runId = 4242;
const artifact = (overrides = {}) => ({
  id: 11,
  name: 'audio-routing-evidence',
  expired: false,
  workflow_run: { id: runId },
  ...overrides
});

test('rejects an invalid expected run id', () => {
  const result = normalizeGitHubArtifactListResponse({ total_count: 0, artifacts: [] }, { run_id: 0 });
  assert.equal(result.decision, 'invalid_expectation');
});

test('rejects a malformed response shape', () => {
  const result = normalizeGitHubArtifactListResponse({ total_count: 1 }, { run_id: runId });
  assert.equal(result.decision, 'artifact_list_shape_invalid');
});

test('rejects inconsistent total_count to prevent silent pagination acceptance', () => {
  const result = normalizeGitHubArtifactListResponse({ total_count: 2, artifacts: [artifact()] }, { run_id: runId });
  assert.equal(result.decision, 'artifact_page_incomplete');
});

test('rejects incomplete artifact identity', () => {
  const result = normalizeGitHubArtifactListResponse({ total_count: 1, artifacts: [artifact({ id: null })] }, { run_id: runId });
  assert.equal(result.decision, 'artifact_identity_incomplete');
});

test('rejects artifacts from another workflow run', () => {
  const result = normalizeGitHubArtifactListResponse({ total_count: 1, artifacts: [artifact({ workflow_run: { id: 99 } })] }, { run_id: runId });
  assert.equal(result.decision, 'artifact_run_mismatch');
});

test('normalizes a complete exact-run artifact list', () => {
  const result = normalizeGitHubArtifactListResponse({ total_count: 1, artifacts: [artifact()] }, { run_id: runId });
  assert.equal(result.accepted, true);
  assert.deepEqual(result.artifacts, [{
    id: 11,
    name: 'audio-routing-evidence',
    expired: false,
    workflow_run_id: runId
  }]);
});
