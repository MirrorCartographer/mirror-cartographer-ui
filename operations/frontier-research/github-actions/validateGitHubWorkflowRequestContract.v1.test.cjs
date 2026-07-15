'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateGitHubWorkflowRequestContract } = require('./validateGitHubWorkflowRequestContract.v1.cjs');

const version = '2026-03-10';
const valid = [
  ['Accept', 'application/vnd.github+json'],
  ['Authorization', 'Bearer secret-token'],
  ['X-GitHub-Api-Version', version],
  ['User-Agent', 'mirror-cartographer-evidence/1']
];

test('accepts an exact versioned authenticated request without retaining credentials', () => {
  const result = validateGitHubWorkflowRequestContract(valid, { expected_api_version: version });
  assert.equal(result.verified, true);
  assert.equal(result.credential_values_retained, false);
  assert.equal(JSON.stringify(result).includes('secret-token'), false);
});

test('rejects semantic drift in media type or API version', () => {
  const result = validateGitHubWorkflowRequestContract([
    ['Accept', 'application/json'],
    ['Authorization', 'Bearer secret-token'],
    ['X-GitHub-Api-Version', '2022-11-28'],
    ['User-Agent', 'mirror-cartographer-evidence/1']
  ], { expected_api_version: version });
  assert.equal(result.verified, false);
  assert.deepEqual(result.reasons.sort(), ['api_version_mismatch', 'unexpected_accept_media_type']);
});

test('rejects duplicate case-insensitive headers', () => {
  const result = validateGitHubWorkflowRequestContract([
    ...valid,
    ['accept', 'application/vnd.github+json']
  ], { expected_api_version: version });
  assert.equal(result.verified, false);
  assert.ok(result.reasons.includes('duplicate_header_accept'));
});

test('rejects absent bearer credentials without exposing supplied values', () => {
  const result = validateGitHubWorkflowRequestContract(valid.filter(([name]) => name !== 'Authorization'), { expected_api_version: version });
  assert.equal(result.verified, false);
  assert.ok(result.reasons.includes('missing_or_invalid_bearer_authorization'));
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'authorization'), false);
});

test('rejects malformed header containers and user agents', () => {
  const malformed = validateGitHubWorkflowRequestContract({}, { expected_api_version: version });
  assert.ok(malformed.reasons.includes('headers_not_entry_array'));

  const newline = validateGitHubWorkflowRequestContract(valid.map(([name, value]) =>
    name === 'User-Agent' ? [name, 'bad\nagent'] : [name, value]
  ), { expected_api_version: version });
  assert.ok(newline.reasons.includes('missing_or_invalid_user_agent'));
});
