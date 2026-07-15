'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { adaptVerifiedVercelEvidence } = require('./verifiedVercelEvidenceAdapter.v1.cjs');
const SHA = 'a'.repeat(40);
const DIGEST = 'b'.repeat(64);
function validPipeline() {
  return {
    verified: true,
    violations: [],
    claim_boundary: 'authenticated_retrieval_and_immutable_deployment_identity_verified_only',
    pipeline_sha256: DIGEST,
    normalized: { expected_commit_sha: SHA },
    retrieval: { verified: true },
    identity: { verified: true, normalized: {
      expected_commit_sha: SHA,
      observed_at: '2026-07-15T19:34:00Z',
      deployment: { id: 'dpl_123', projectId: 'prj_123', url: 'example-deployment.vercel.app', gitSource: { sha: SHA } }
    }}
  };
}
test('accepts verified composed output', () => {
  const result = adaptVerifiedVercelEvidence({ expected_commit_sha: SHA, pipeline: validPipeline() });
  assert.equal(result.verified, true);
  assert.equal(result.evidence.deployment_id, 'dpl_123');
});
test('rejects raw deployment input', () => {
  const result = adaptVerifiedVercelEvidence({ expected_commit_sha: SHA, pipeline: { id: 'dpl_raw' } });
  assert.equal(result.verified, false);
  assert.equal(result.evidence, null);
});
test('rejects retrieval failure', () => {
  const pipeline = validPipeline(); pipeline.retrieval.verified = false;
  const result = adaptVerifiedVercelEvidence({ expected_commit_sha: SHA, pipeline });
  assert.ok(result.violations.includes('retrieval:not_verified'));
});
test('rejects commit mismatch', () => {
  const result = adaptVerifiedVercelEvidence({ expected_commit_sha: 'c'.repeat(40), pipeline: validPipeline() });
  assert.ok(result.violations.includes('binding:pipeline_commit_mismatch'));
  assert.ok(result.violations.includes('binding:identity_commit_mismatch'));
  assert.ok(result.violations.includes('binding:deployment_commit_mismatch'));
});
test('rejects retained violations', () => {
  const pipeline = validPipeline(); pipeline.violations = ['identity:state_not_ready'];
  const result = adaptVerifiedVercelEvidence({ expected_commit_sha: SHA, pipeline });
  assert.ok(result.violations.includes('pipeline:violations_present'));
});
test('rejects missing pipeline digest', () => {
  const pipeline = validPipeline(); pipeline.pipeline_sha256 = null;
  const result = adaptVerifiedVercelEvidence({ expected_commit_sha: SHA, pipeline });
  assert.ok(result.violations.includes('pipeline:sha256_invalid'));
});
