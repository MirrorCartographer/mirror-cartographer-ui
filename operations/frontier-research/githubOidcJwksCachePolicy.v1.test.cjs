'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { assessGithubOidcJwksCache } = require('./githubOidcJwksCachePolicy.v1.cjs');

const key = (kid) => ({ kty: 'RSA', kid, n: 'test', e: 'AQAB' });
const base = {
  observed_at_epoch: 10_000,
  cached_fetched_at_epoch: 9_500,
  cached_max_age_seconds: 900,
  hard_max_age_seconds: 3_600,
  token_kid: 'old',
  cached_jwks: { keys: [key('old')] },
  refresh_attempted: false
};

test('accepts one unique RSA kid from a fresh bounded cache', () => {
  const result = assessGithubOidcJwksCache(base);
  assert.equal(result.accepted, true);
  assert.equal(result.cache_status, 'fresh_cache_hit');
  assert.equal(result.selected_jwks, base.cached_jwks);
});

test('unknown kid requires one synchronous refresh even while cache is fresh', () => {
  const result = assessGithubOidcJwksCache({ ...base, token_kid: 'new' });
  assert.equal(result.accepted, false);
  assert.equal(result.refresh_required, true);
  assert.deepEqual(result.violations, ['jwks:unknown_kid_requires_refresh']);
  assert.equal(result.selected_jwks, null);
});

test('accepts a rotated key only after refreshed JWKS contains one unique RSA match', () => {
  const refreshed = { keys: [key('old'), key('new')] };
  const result = assessGithubOidcJwksCache({
    ...base,
    token_kid: 'new',
    refresh_attempted: true,
    refreshed_jwks: refreshed
  });
  assert.equal(result.accepted, true);
  assert.equal(result.cache_status, 'rotated_key_refresh_hit');
  assert.equal(result.selected_jwks, refreshed);
});

test('rejects unknown kid when refresh fails instead of trusting another cached key', () => {
  const result = assessGithubOidcJwksCache({
    ...base,
    token_kid: 'new',
    refresh_attempted: true,
    refreshed_jwks: null
  });
  assert.equal(result.accepted, false);
  assert.equal(result.refresh_required, false);
  assert.deepEqual(result.violations, ['jwks:unknown_kid_refresh_failed']);
});

test('stale cache requires refresh and is never used under outage', () => {
  const stale = { ...base, observed_at_epoch: 10_401 };
  const before = assessGithubOidcJwksCache(stale);
  assert.equal(before.accepted, false);
  assert.equal(before.refresh_required, true);
  assert.deepEqual(before.violations, ['jwks:stale_cache_requires_refresh']);

  const outage = assessGithubOidcJwksCache({
    ...stale,
    refresh_attempted: true,
    refreshed_jwks: undefined
  });
  assert.equal(outage.accepted, false);
  assert.deepEqual(outage.violations, ['jwks:stale_cache_refresh_failed']);
  assert.equal(outage.selected_jwks, null);
});

test('hard maximum bounds an excessively permissive provider max-age', () => {
  const result = assessGithubOidcJwksCache({
    ...base,
    observed_at_epoch: 13_101,
    cached_max_age_seconds: 86_400
  });
  assert.equal(result.accepted, false);
  assert.equal(result.refresh_required, true);
  assert.equal(result.violations[0], 'jwks:stale_cache_requires_refresh');
});

test('duplicate matching kid in refreshed JWKS fails closed', () => {
  const result = assessGithubOidcJwksCache({
    ...base,
    token_kid: 'new',
    refresh_attempted: true,
    refreshed_jwks: { keys: [key('new'), key('new')] }
  });
  assert.equal(result.accepted, false);
  assert.deepEqual(result.violations, ['jwks:refreshed_kid_not_unique']);
});
