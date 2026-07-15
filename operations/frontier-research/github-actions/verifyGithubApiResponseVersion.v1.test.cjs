'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { verifyGithubApiResponseVersion } = require('./verifyGithubApiResponseVersion.v1.cjs');

function valid(overrides = {}) {
  return {
    request: {
      api_version: '2026-03-10',
      headers: { 'X-GitHub-Api-Version': '2026-03-10' }
    },
    response: { status: 200, headers: {} },
    ...overrides
  };
}

test('accepts matching explicit version on successful response', () => {
  assert.equal(verifyGithubApiResponseVersion(valid()).verified, true);
});

test('rejects missing explicit request header', () => {
  const x = valid(); delete x.request.headers['X-GitHub-Api-Version'];
  assert.deepEqual(verifyGithubApiResponseVersion(x).reasons, ['missing_api_version_request_header']);
});

test('rejects configured/header mismatch', () => {
  const x = valid(); x.request.headers['X-GitHub-Api-Version'] = '2022-11-28';
  assert.ok(verifyGithubApiResponseVersion(x).reasons.includes('request_header_version_mismatch'));
});

test('rejects 410 Gone', () => {
  const x = valid(); x.response.status = 410;
  assert.ok(verifyGithubApiResponseVersion(x).reasons.includes('api_version_gone'));
});

test('rejects deprecation and sunset response signals case-insensitively', () => {
  const x = valid(); x.response.headers = { Deprecation: 'Tue, 10 Mar 2026 00:00:00 GMT', SUNSET: 'Fri, 10 Mar 2028 00:00:00 GMT' };
  const r = verifyGithubApiResponseVersion(x);
  assert.ok(r.reasons.includes('api_version_deprecation_announced'));
  assert.ok(r.reasons.includes('api_version_sunset_announced'));
});

test('rejects non-2xx responses separately from 410', () => {
  const x = valid(); x.response.status = 403;
  assert.deepEqual(verifyGithubApiResponseVersion(x).reasons, ['non_success_response_status']);
});
