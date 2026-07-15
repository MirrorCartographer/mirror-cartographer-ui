'use strict';

const crypto = require('node:crypto');

const DEPLOYMENT_ID = /^dpl_[A-Za-z0-9]+$/;
const SHA256 = /^[0-9a-f]{64}$/;

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function digest(value) {
  return crypto.createHash('sha256').update(canonical(value)).digest('hex');
}

function validateVercelDeploymentRetrievalEnvelope(input) {
  const violations = [];
  const expectedDeploymentId = String(input?.expected_deployment_id || '');
  const expectedProjectId = String(input?.expected_project_id || '');
  const request = input?.request;
  const response = input?.response;

  if (!DEPLOYMENT_ID.test(expectedDeploymentId)) violations.push('expected_deployment_id_invalid');
  if (!expectedProjectId) violations.push('expected_project_id_missing');
  if (!input?.observed_at || Number.isNaN(Date.parse(input.observed_at))) violations.push('observed_at_invalid');

  if (!request || typeof request !== 'object') {
    violations.push('request_missing');
  } else {
    if (request.method !== 'GET') violations.push('request_method_not_get');
    if (request.api_version !== 'v13') violations.push('api_version_not_v13');
    if (request.path !== `/v13/deployments/${expectedDeploymentId}`) violations.push('request_path_mismatch');
    if (request.auth_present !== true) violations.push('authenticated_request_unproven');
    if (request.auth_material_persisted === true) violations.push('credential_material_persisted');
    if (request.project_id !== expectedProjectId) violations.push('request_project_scope_mismatch');
  }

  if (!response || typeof response !== 'object') {
    violations.push('response_missing');
  } else {
    if (response.status_code !== 200) violations.push('response_status_not_200');
    if (!response.body || typeof response.body !== 'object') violations.push('response_body_missing');
    if (!SHA256.test(String(response.body_sha256 || ''))) violations.push('response_digest_invalid');
    if (response.body && digest(response.body) !== response.body_sha256) violations.push('response_digest_mismatch');
    if (response.body?.id !== expectedDeploymentId) violations.push('response_deployment_id_mismatch');
    if (response.body?.projectId !== expectedProjectId) violations.push('response_project_id_mismatch');
  }

  const normalized = {
    schema_version: 1,
    expected_deployment_id: expectedDeploymentId || null,
    expected_project_id: expectedProjectId || null,
    observed_at: input?.observed_at || null,
    request: request ? {
      method: request.method || null,
      api_version: request.api_version || null,
      path: request.path || null,
      auth_present: request.auth_present === true,
      auth_material_persisted: request.auth_material_persisted === true,
      project_id: request.project_id || null,
      team_id: request.team_id || null
    } : null,
    response: response ? {
      status_code: response.status_code ?? null,
      body_sha256: response.body_sha256 || null,
      deployment_id: response.body?.id || null,
      project_id: response.body?.projectId || null
    } : null
  };

  return {
    verified: violations.length === 0,
    violations,
    normalized,
    envelope_sha256: digest(normalized),
    claim_boundary: violations.length === 0
      ? 'authenticated_exact_deployment_retrieval_verified_only'
      : 'deployment_retrieval_unverified'
  };
}

module.exports = { canonical, digest, validateVercelDeploymentRetrievalEnvelope };
