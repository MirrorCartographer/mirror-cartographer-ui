'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { digest, validateVercelDeploymentRetrievalEnvelope } = require('./vercelDeploymentRetrievalEnvelope.v1.cjs');

const body = { id: 'dpl_AbC123', projectId: 'prj_exact', readyState: 'READY' };

function valid(overrides = {}) {
  const base = {
    expected_deployment_id: 'dpl_AbC123',
    expected_project_id: 'prj_exact',
    observed_at: '2026-07-15T19:19:47Z',
    request: {
      method: 'GET', api_version: 'v13', path: '/v13/deployments/dpl_AbC123',
      auth_present: true, auth_material_persisted: false, project_id: 'prj_exact', team_id: null
    },
    response: { status_code: 200, body, body_sha256: digest(body) }
  };
  return { ...base, ...overrides };
}

test('accepts exact authenticated scoped retrieval', () => {
  assert.equal(validateVercelDeploymentRetrievalEnvelope(valid()).verified, true);
});

test('rejects copied response with no authenticated request proof', () => {
  const input = valid(); input.request.auth_present = false;
  assert.ok(validateVercelDeploymentRetrievalEnvelope(input).violations.includes('authenticated_request_unproven'));
});

test('rejects request path drift', () => {
  const input = valid(); input.request.path = '/v13/deployments/dpl_Other';
  assert.ok(validateVercelDeploymentRetrievalEnvelope(input).violations.includes('request_path_mismatch'));
});

test('rejects response body tampering', () => {
  const input = valid(); input.response.body = { ...body, readyState: 'ERROR' };
  assert.ok(validateVercelDeploymentRetrievalEnvelope(input).violations.includes('response_digest_mismatch'));
});

test('rejects cross-project response', () => {
  const other = { ...body, projectId: 'prj_other' };
  const input = valid({ response: { status_code: 200, body: other, body_sha256: digest(other) } });
  assert.ok(validateVercelDeploymentRetrievalEnvelope(input).violations.includes('response_project_id_mismatch'));
});

test('rejects persisted credential material', () => {
  const input = valid(); input.request.auth_material_persisted = true;
  assert.ok(validateVercelDeploymentRetrievalEnvelope(input).violations.includes('credential_material_persisted'));
});
