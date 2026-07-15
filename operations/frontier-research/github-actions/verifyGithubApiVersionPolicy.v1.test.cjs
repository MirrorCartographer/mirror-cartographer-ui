'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { SUPPORTED_VERSIONS, verifyGithubApiVersionPolicy } = require('./verifyGithubApiVersionPolicy.v1.cjs');

const NOW = new Date('2026-07-15T01:52:52Z');
const SOURCE = 'https://docs.github.com/en/rest/about-the-rest-api/api-versions';

function packet(api_version, observed = '2026-07-15T01:50:00Z') {
  return { api_version, policy_observed_at: observed, source: SOURCE };
}

test('supported versions are frozen and explicit', () => {
  assert.equal(Object.isFrozen(SUPPORTED_VERSIONS), true);
  assert.deepEqual(Object.keys(SUPPORTED_VERSIONS).sort(), ['2022-11-28', '2026-03-10']);
});

test('accepts current version', () => {
  const out = verifyGithubApiVersionPolicy(packet('2026-03-10'), NOW);
  assert.equal(out.verified, true);
  assert.equal(out.version_status, 'current');
});

test('accepts supported legacy version before end date', () => {
  const out = verifyGithubApiVersionPolicy(packet('2022-11-28'), NOW);
  assert.equal(out.verified, true);
  assert.equal(out.end_of_support, '2028-03-10');
});

test('rejects invented date-shaped version', () => {
  const out = verifyGithubApiVersionPolicy(packet('2025-01-01'), NOW);
  assert.equal(out.verified, false);
  assert.ok(out.reasons.includes('unsupported_or_unrecognized_api_version'));
});

test('rejects stale policy observation', () => {
  const out = verifyGithubApiVersionPolicy(packet('2026-03-10', '2026-05-01T00:00:00Z'), NOW);
  assert.ok(out.reasons.includes('policy_observation_stale'));
});

test('rejects legacy version after support window ends', () => {
  const out = verifyGithubApiVersionPolicy(packet('2022-11-28', '2028-03-10T00:00:00Z'), new Date('2028-03-10T00:00:00Z'));
  assert.ok(out.reasons.includes('api_version_support_window_ended'));
});
