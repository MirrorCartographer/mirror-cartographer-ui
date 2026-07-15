'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { digest } = require('./vercelDeploymentRetrievalEnvelope.v1.cjs');
const { assessVercelDeploymentEvidencePipeline } = require('./vercelDeploymentEvidencePipeline.v1.cjs');

const sha = '0123456789abcdef0123456789abcdef01234567';

function body(overrides = {}) {
  return {
    id: 'dpl_Abc123',
    url: 'mc-abc.vercel.app',
    projectId: 'prj_123',
    name: 'mirror-cartographer-ui',
    readyState: 'READY',
    status: 'READY',
    createdAt: 1784140000000,
    gitSource: { type: 'github', sha, repoId: 1003910384, ref: 'main' },
    ...overrides
  };
}

function input(overrides = {}) {
  const responseBody = body();
  return {
    expected_commit_sha: sha,
    retrieval: {
      expected_deployment_id: 'dpl_Abc123',
      expected_project_id: 'prj_123',
      observed_at: '2026-07-15T19:25:00Z',
      request: {
        method: 'GET',
        api_version: 'v13',
        path: '/v13/deployments/dpl_Abc123',
        auth_present: true,
        auth_material_persisted: false,
        project_id: 'prj_123'
      },
      response: {
        status_code: 200,
        body: responseBody,
        body_sha256: digest(responseBody)
      }
    },
    ...overrides
  };
}

test('accepts authenticated retrieval bound to immutable identity', () => {
  const result = assessVercelDeploymentEvidencePipeline(input());
  assert.equal(result.verified, true);
  assert.equal(result.claim_boundary, 'authenticated_retrieval_and_immutable_deployment_identity_verified_only');
});

test('rejects unauthenticated retrieval before identity evaluation', () => {
  const value = input();
  value.retrieval.request.auth_present = false;
  const result = assessVercelDeploymentEvidencePipeline(value);
  assert.equal(result.verified, false);
  assert.equal(result.identity, null);
  assert.ok(result.violations.includes('retrieval:authenticated_request_unproven'));
});

test('rejects tampered response body before identity evaluation', () => {
  const value = input();
  value.retrieval.response.body.readyState = 'ERROR';
  const result = assessVercelDeploymentEvidencePipeline(value);
  assert.equal(result.identity, null);
  assert.ok(result.violations.includes('retrieval:response_digest_mismatch'));
});

test('rejects exact retrieval whose immutable identity is not READY', () => {
  const value = input();
  value.retrieval.response.body = body({ readyState: 'ERROR', status: 'ERROR' });
  value.retrieval.response.body_sha256 = digest(value.retrieval.response.body);
  const result = assessVercelDeploymentEvidencePipeline(value);
  assert.equal(result.verified, false);
  assert.ok(result.violations.includes('identity:deployment_not_ready'));
});

test('rejects exact retrieval whose git sha differs', () => {
  const value = input();
  value.retrieval.response.body = body({
    gitSource: {
      type: 'github',
      sha: 'abcdefabcdefabcdefabcdefabcdefabcdefabcd',
      repoId: 1003910384,
      ref: 'main'
    }
  });
  value.retrieval.response.body_sha256 = digest(value.retrieval.response.body);
  const result = assessVercelDeploymentEvidencePipeline(value);
  assert.ok(result.violations.includes('identity:commit_mismatch'));
});

test('pipeline digest is deterministic and changes with evidence identity', () => {
  const first = assessVercelDeploymentEvidencePipeline(input());
  const second = assessVercelDeploymentEvidencePipeline(input());
  assert.equal(first.pipeline_sha256, second.pipeline_sha256);

  const value = input();
  value.retrieval.response.body = body({ url: 'mc-def.vercel.app' });
  value.retrieval.response.body_sha256 = digest(value.retrieval.response.body);
  const changed = assessVercelDeploymentEvidencePipeline(value);
  assert.notEqual(first.pipeline_sha256, changed.pipeline_sha256);
});
