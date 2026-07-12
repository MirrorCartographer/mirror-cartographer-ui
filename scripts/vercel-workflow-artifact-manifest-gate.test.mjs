import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateArtifactManifest } from './vercel-workflow-artifact-manifest-gate.mjs';

const expected = { run_id: 42, required_artifacts: ['audio-route-evidence', 'deployment-identity'] };
const valid = [
  { id: 1, name: 'audio-route-evidence', expired: false, workflow_run: { id: 42 } },
  { id: 2, name: 'deployment-identity', expired: false, workflow_run: { id: 42 } }
];

test('accepts unique unexpired artifacts bound to expected run', () => {
  assert.equal(evaluateArtifactManifest({ artifacts: valid }, expected).accepted, true);
});

test('rejects artifact from another run', () => {
  const artifacts = structuredClone(valid); artifacts[0].workflow_run.id = 41;
  assert.equal(evaluateArtifactManifest({ artifacts }, expected).decision, 'artifact_run_mismatch');
});

test('rejects expired artifact', () => {
  const artifacts = structuredClone(valid); artifacts[0].expired = true;
  assert.equal(evaluateArtifactManifest({ artifacts }, expected).decision, 'artifact_expired');
});

test('rejects duplicate artifact names', () => {
  const artifacts = [...valid, { id: 3, name: 'audio-route-evidence', expired: false, workflow_run: { id: 42 } }];
  assert.equal(evaluateArtifactManifest({ artifacts }, expected).decision, 'artifact_name_ambiguous');
});

test('rejects missing required artifact', () => {
  assert.equal(evaluateArtifactManifest({ artifacts: valid.slice(0, 1) }, expected).decision, 'required_artifact_missing');
});

test('rejects incomplete artifact identity', () => {
  assert.equal(evaluateArtifactManifest({ artifacts: [{ name: 'audio-route-evidence', workflow_run: { id: 42 } }] }, expected).decision, 'artifact_identity_incomplete');
});
