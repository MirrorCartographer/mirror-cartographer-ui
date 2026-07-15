'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateImmutableDeploymentEvidence } = require('./vercelImmutableDeploymentEvidence.v1.cjs');

const SHA = 'a'.repeat(40);
function fixture(overrides = {}) {
  return {
    expected_commit_sha: SHA,
    observed_at: '2026-07-15T06:50:00Z',
    source: 'vercel_api_v13_get_deployment',
    deployment: {
      id: 'dpl_89qyp1cskzkLrVicDaZoDbjyHuDJ',
      url: 'mirror-cartographer-ui-abc123.vercel.app',
      projectId: 'prj_example',
      name: 'mirror-cartographer-ui',
      createdAt: 1784098200000,
      ready: 1784098260000,
      readyState: 'READY',
      status: 'READY',
      target: 'production',
      gitSource: { type: 'github', repoId: 1003910384, ref: 'main', sha: SHA },
      ...overrides
    }
  };
}

test('accepts a READY deployment bound to the exact GitHub commit', () => {
  const result = validateImmutableDeploymentEvidence(fixture());
  assert.equal(result.verified, true);
  assert.deepEqual(result.violations, []);
  assert.match(result.sha256, /^[0-9a-f]{64}$/);
  assert.equal(result.claim_boundary, 'immutable_deployment_identity_verified_only');
});

test('fails closed on commit mismatch', () => {
  const result = validateImmutableDeploymentEvidence(fixture({ gitSource: { type: 'github', sha: 'b'.repeat(40) } }));
  assert.equal(result.verified, false);
  assert.ok(result.violations.includes('commit_mismatch'));
});

test('fails closed when deployment is not READY', () => {
  const result = validateImmutableDeploymentEvidence(fixture({ readyState: 'ERROR', status: 'ERROR' }));
  assert.equal(result.verified, false);
  assert.ok(result.violations.includes('deployment_not_ready'));
});

test('fails closed on mutable alias-only or missing deployment identity', () => {
  const result = validateImmutableDeploymentEvidence(fixture({ id: '', url: 'mirrorcartographer.com' }));
  assert.equal(result.verified, false);
  assert.ok(result.violations.includes('deployment_id_invalid'));
});

test('fails closed for deleted or retention-only records', () => {
  const result = validateImmutableDeploymentEvidence(fixture({ softDeletedByRetention: true }));
  assert.equal(result.verified, false);
  assert.ok(result.violations.includes('deployment_deleted_or_retained_only'));
});

test('canonical digest is stable across object key order', () => {
  const left = validateImmutableDeploymentEvidence(fixture());
  const right = validateImmutableDeploymentEvidence({
    source: 'vercel_api_v13_get_deployment',
    observed_at: '2026-07-15T06:50:00Z',
    deployment: fixture().deployment,
    expected_commit_sha: SHA
  });
  assert.equal(left.sha256, right.sha256);
});
