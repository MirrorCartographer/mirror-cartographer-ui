import test from 'node:test';
import assert from 'node:assert/strict';
import { assessGitHubAttestationEligibility } from './github-attestation-eligibility.mjs';

test('public repository is eligible without Enterprise Cloud evidence', () => {
  const result = assessGitHubAttestationEligibility({
    repository: 'MirrorCartographer/example',
    visibility: 'public',
    plan_status: 'unknown'
  });
  assert.equal(result.eligible, true);
  assert.equal(result.reason, 'public_repository_supported_on_current_plans');
});

test('private repository with unknown plan fails closed', () => {
  const result = assessGitHubAttestationEligibility({
    repository: 'MirrorCartographer/mirror-cartographer-ui',
    visibility: 'private',
    plan_status: 'unknown'
  });
  assert.equal(result.eligible, false);
  assert.equal(result.reason, 'enterprise_cloud_plan_unverified');
});

test('private repository with verified non-Enterprise plan is blocked', () => {
  const result = assessGitHubAttestationEligibility({
    repository: 'MirrorCartographer/mirror-cartographer-ui',
    visibility: 'private',
    plan_status: 'verified_non_enterprise'
  });
  assert.equal(result.eligible, false);
  assert.equal(result.reason, 'private_or_internal_repository_requires_enterprise_cloud');
});

test('verified Enterprise status without provenance is rejected', () => {
  const result = assessGitHubAttestationEligibility({
    repository: 'MirrorCartographer/mirror-cartographer-ui',
    visibility: 'private',
    plan_status: 'verified_enterprise_cloud'
  });
  assert.equal(result.eligible, false);
  assert.equal(result.reason, 'enterprise_cloud_evidence_missing_or_invalid');
});

test('private repository with valid Enterprise Cloud evidence is eligible', () => {
  const result = assessGitHubAttestationEligibility({
    repository: 'MirrorCartographer/mirror-cartographer-ui',
    visibility: 'private',
    plan_status: 'verified_enterprise_cloud',
    plan_evidence: {
      verified: true,
      source: 'github-billing-or-enterprise-settings',
      observed_at: '2026-07-13T17:19:07Z'
    }
  });
  assert.equal(result.eligible, true);
  assert.equal(result.reason, 'private_or_internal_repository_with_verified_enterprise_cloud');
});

test('invalid plan evidence timestamp fails closed', () => {
  const result = assessGitHubAttestationEligibility({
    repository: 'MirrorCartographer/mirror-cartographer-ui',
    visibility: 'private',
    plan_status: 'verified_enterprise_cloud',
    plan_evidence: {
      verified: true,
      source: 'github-billing-or-enterprise-settings',
      observed_at: 'not-a-date'
    }
  });
  assert.equal(result.eligible, false);
  assert.equal(result.reason, 'enterprise_cloud_evidence_missing_or_invalid');
});
