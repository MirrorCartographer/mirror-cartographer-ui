'use strict';

const DEFAULT_HARD_MAX_AGE_SECONDS = 3600;

function reject(violations, refresh_required = false) {
  return {
    accepted: false,
    violations: [...new Set(violations)].sort(),
    refresh_required,
    selected_jwks: null,
    cache_status: 'rejected',
    claim_boundary: 'jwks_cache_policy_only_no_network_fetch_or_jwt_signature_claim'
  };
}

function validJwks(value) {
  return value && Array.isArray(value.keys) && value.keys.length > 0;
}

function uniqueKidExists(jwks, kid) {
  if (!validJwks(jwks) || typeof kid !== 'string' || !kid) return false;
  return jwks.keys.filter((key) => key && key.kid === kid && key.kty === 'RSA').length === 1;
}

function assessGithubOidcJwksCache(input = {}) {
  const now = input.observed_at_epoch;
  const fetchedAt = input.cached_fetched_at_epoch;
  const advertisedMaxAge = input.cached_max_age_seconds;
  const hardMaxAge = Number.isInteger(input.hard_max_age_seconds)
    ? input.hard_max_age_seconds
    : DEFAULT_HARD_MAX_AGE_SECONDS;
  const kid = input.token_kid;
  const cached = input.cached_jwks;
  const refreshed = input.refreshed_jwks;
  const refreshAttempted = input.refresh_attempted === true;
  const violations = [];

  if (!Number.isInteger(now) || now < 0) violations.push('jwks:observed_at_invalid');
  if (!Number.isInteger(fetchedAt) || fetchedAt < 0) violations.push('jwks:cached_fetched_at_invalid');
  if (!Number.isInteger(advertisedMaxAge) || advertisedMaxAge < 0) violations.push('jwks:cached_max_age_invalid');
  if (!Number.isInteger(hardMaxAge) || hardMaxAge <= 0) violations.push('jwks:hard_max_age_invalid');
  if (typeof kid !== 'string' || !kid) violations.push('jwks:token_kid_invalid');
  if (!validJwks(cached)) violations.push('jwks:cached_keys_missing');
  if (violations.length) return reject(violations);

  const effectiveMaxAge = Math.min(advertisedMaxAge, hardMaxAge);
  const age = now - fetchedAt;
  if (age < 0) return reject(['jwks:cache_from_future']);
  const cacheFresh = age <= effectiveMaxAge;
  const cachedHasKid = uniqueKidExists(cached, kid);

  if (cacheFresh && cachedHasKid) {
    return {
      accepted: true,
      violations: [],
      refresh_required: false,
      selected_jwks: cached,
      cache_status: 'fresh_cache_hit',
      cache_age_seconds: age,
      effective_max_age_seconds: effectiveMaxAge,
      claim_boundary: 'fresh_unique_rsa_kid_selected_no_jwt_signature_claim'
    };
  }

  if (!refreshAttempted) {
    return reject([
      cacheFresh ? 'jwks:unknown_kid_requires_refresh' : 'jwks:stale_cache_requires_refresh'
    ], true);
  }

  if (!validJwks(refreshed)) {
    return reject([
      cacheFresh ? 'jwks:unknown_kid_refresh_failed' : 'jwks:stale_cache_refresh_failed'
    ], false);
  }

  if (!uniqueKidExists(refreshed, kid)) {
    return reject(['jwks:refreshed_kid_not_unique']);
  }

  return {
    accepted: true,
    violations: [],
    refresh_required: false,
    selected_jwks: refreshed,
    cache_status: cacheFresh ? 'rotated_key_refresh_hit' : 'stale_cache_refresh_hit',
    cache_age_seconds: age,
    effective_max_age_seconds: effectiveMaxAge,
    claim_boundary: 'refreshed_unique_rsa_kid_selected_no_jwt_signature_claim'
  };
}

module.exports = {
  assessGithubOidcJwksCache,
  DEFAULT_HARD_MAX_AGE_SECONDS
};
