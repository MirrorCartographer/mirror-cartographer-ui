'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSanitizedGithubResponseEvidence } = require('./buildSanitizedGithubResponseEvidence.v1.cjs');

test('retains only allowlisted request and response evidence', () => {
  const result = buildSanitizedGithubResponseEvidence({
    request: {
      api_version: '2022-11-28',
      headers: {
        Authorization: 'Bearer secret',
        Accept: 'application/vnd.github+json',
        'User-Agent': 'mirror-cartographer-evidence/1',
        'X-GitHub-Api-Version': '2022-11-28',
        'X-Unrelated': 'discard-me'
      }
    },
    response: {
      status: 200,
      headers: {
        Link: '<next>; rel="next"',
        Deprecation: 'true',
        Sunset: 'Wed, 01 Jan 2030 00:00:00 GMT',
        'X-GitHub-Request-Id': 'ABC:123',
        'Set-Cookie': 'secret-cookie'
      }
    }
  });

  assert.equal(result.verified, true);
  assert.deepEqual(result.request.sensitive_headers_observed, ['authorization']);
  assert.equal(result.request.sensitive_header_values_retained, false);
  assert.equal(JSON.stringify(result).includes('Bearer secret'), false);
  assert.equal(JSON.stringify(result).includes('secret-cookie'), false);
  assert.equal(JSON.stringify(result).includes('discard-me'), false);
  assert.equal(result.response.headers.Link, '<next>; rel="next"');
});

test('normalizes header names case-insensitively', () => {
  const result = buildSanitizedGithubResponseEvidence({
    request: {
      api_version: '2022-11-28',
      headers: { 'x-github-api-version': '2022-11-28', accept: 'application/json' }
    },
    response: { status: 204, headers: { sunset: 'later' } }
  });
  assert.equal(result.request.headers['X-GitHub-Api-Version'], '2022-11-28');
  assert.equal(result.response.headers.Sunset, 'later');
});

test('fails closed when required response evidence is absent', () => {
  const result = buildSanitizedGithubResponseEvidence({ request: {}, response: {} });
  assert.equal(result.verified, false);
  assert.deepEqual(result.reasons, [
    'missing_requested_api_version',
    'missing_transmitted_api_version',
    'invalid_response_status'
  ]);
});

test('never retains sensitive values even when represented as arrays', () => {
  const result = buildSanitizedGithubResponseEvidence({
    request: {
      api_version: '2022-11-28',
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
        Cookie: ['a=1', 'b=2'],
        'Proxy-Authorization': ['Basic abc']
      }
    },
    response: { status: 200, headers: {} }
  });
  const serialized = JSON.stringify(result);
  assert.deepEqual(result.request.sensitive_headers_observed, ['cookie', 'proxy-authorization']);
  assert.equal(serialized.includes('a=1'), false);
  assert.equal(serialized.includes('Basic abc'), false);
});
