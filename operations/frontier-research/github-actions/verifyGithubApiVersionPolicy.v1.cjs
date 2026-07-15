'use strict';

const SUPPORTED_VERSIONS = Object.freeze({
  '2026-03-10': { end_of_support: null, status: 'current' },
  '2022-11-28': { end_of_support: '2028-03-10', status: 'supported_legacy' }
});

function verifyGithubApiVersionPolicy(input, now = new Date()) {
  const reasons = [];
  const version = input?.api_version;
  const policyObservedAt = input?.policy_observed_at;
  const source = input?.source;

  if (!Object.prototype.hasOwnProperty.call(SUPPORTED_VERSIONS, version)) {
    reasons.push('unsupported_or_unrecognized_api_version');
  }
  if (source !== 'https://docs.github.com/en/rest/about-the-rest-api/api-versions') {
    reasons.push('unapproved_policy_source');
  }
  const observed = new Date(policyObservedAt);
  if (!policyObservedAt || Number.isNaN(observed.getTime())) {
    reasons.push('invalid_policy_observed_at');
  } else {
    const ageMs = now.getTime() - observed.getTime();
    if (ageMs < -5 * 60 * 1000) reasons.push('policy_observation_from_future');
    if (ageMs > 30 * 24 * 60 * 60 * 1000) reasons.push('policy_observation_stale');
  }

  const metadata = SUPPORTED_VERSIONS[version] || null;
  if (metadata?.end_of_support) {
    const end = new Date(`${metadata.end_of_support}T00:00:00Z`);
    if (now >= end) reasons.push('api_version_support_window_ended');
  }

  return {
    schema_version: 1,
    classification: reasons.length ? 'rejected' : 'github_api_version_policy_verified',
    verified: reasons.length === 0,
    reasons,
    api_version: version || null,
    version_status: metadata?.status || null,
    end_of_support: metadata?.end_of_support || null,
    policy_observed_at: policyObservedAt || null
  };
}

module.exports = { SUPPORTED_VERSIONS, verifyGithubApiVersionPolicy };
