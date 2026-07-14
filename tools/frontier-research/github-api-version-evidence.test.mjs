import test from 'node:test';
import assert from 'node:assert/strict';
import { assessGitHubApiVersionEvidence } from './github-api-version-evidence.mjs';

const snapshot = {
  source: 'https://docs.github.com/en/rest/about-the-rest-api/api-versions',
  observedAt: '2026-07-14T12:08:00Z',
  latestVersion: '2026-03-10',
  versions: [
    { version: '2026-03-10', endOfSupport: null },
    { version: '2022-11-28', endOfSupport: '2028-03-10' }
  ]
};

test('accepts the pinned supported API version when the response has no lifecycle warning', () => {
  const result = assessGitHubApiVersionEvidence({
    requestedVersion: '2022-11-28',
    responseStatus: 200,
    responseHeaders: {},
    retrievedAt: '2026-07-14T12:08:48Z',
    supportedVersionsSnapshot: snapshot
  });

  assert.equal(result.verified, true);
  assert.equal(result.migrationRequired, false);
  assert.equal(result.supportedSnapshot.requestedVersionEndOfSupport, '2028-03-10');
  assert.deepEqual(result.reasons, []);
});

test('fails closed when GitHub returns 410 Gone', () => {
  const result = assessGitHubApiVersionEvidence({
    requestedVersion: '2022-11-28',
    responseStatus: 410,
    responseHeaders: {},
    retrievedAt: '2028-03-11T00:00:00Z',
    supportedVersionsSnapshot: snapshot
  });

  assert.equal(result.verified, false);
  assert.equal(result.migrationRequired, true);
  assert.ok(result.reasons.includes('api_version_gone'));
  assert.ok(result.reasons.includes('http_410'));
});

test('fails closed when deprecation or sunset headers appear', () => {
  const result = assessGitHubApiVersionEvidence({
    requestedVersion: '2022-11-28',
    responseStatus: 200,
    responseHeaders: {
      Deprecation: 'Tue, 01 Dec 2026 00:00:00 GMT',
      Sunset: 'Wed, 10 Mar 2028 00:00:00 GMT'
    },
    retrievedAt: '2026-12-02T00:00:00Z',
    supportedVersionsSnapshot: snapshot
  });

  assert.equal(result.verified, false);
  assert.equal(result.migrationRequired, true);
  assert.ok(result.reasons.includes('deprecation_header_observed'));
  assert.ok(result.reasons.includes('sunset_header_observed'));
});

test('rejects unsupported versions even when the HTTP response succeeds', () => {
  const result = assessGitHubApiVersionEvidence({
    requestedVersion: '2024-01-01',
    responseStatus: 200,
    responseHeaders: {},
    retrievedAt: '2026-07-14T12:08:48Z',
    supportedVersionsSnapshot: snapshot
  });

  assert.equal(result.verified, false);
  assert.equal(result.migrationRequired, true);
  assert.ok(result.reasons.includes('requested_version_absent_from_supported_snapshot'));
});
