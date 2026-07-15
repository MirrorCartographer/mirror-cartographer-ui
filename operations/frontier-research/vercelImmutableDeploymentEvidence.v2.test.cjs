'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateImmutableDeploymentEvidenceV2 } = require('./vercelImmutableDeploymentEvidence.v2.cjs');
const SHA = 'a'.repeat(40);
function fixture(overrides = {}) {
  return {
    expected: { commit_sha: SHA, project_id: 'prj_expected', project_name: 'mirror-cartographer-ui', repo_id: 1003910384, ref: 'main' },
    observed_at: '2026-07-15T18:03:47Z',
    source: 'vercel_api_v13_get_deployment',
    deployment: {
      id: 'dpl_89qyp1cskzkLrVicDaZoDbjyHuDJ', url: 'mirror-cartographer-ui-abc123.vercel.app',
      projectId: 'prj_expected', name: 'mirror-cartographer-ui', createdAt: 1784098200000,
      ready: 1784098260000, readyState: 'READY', status: 'READY', target: 'production',
      gitSource: { type: 'github', repoId: 1003910384, ref: 'main', sha: SHA }, ...overrides
    }
  };
}
test('accepts exact project repository ref and commit identity', () => assert.equal(validateImmutableDeploymentEvidenceV2(fixture()).verified, true));
test('rejects a READY deployment from another project', () => {
  const r = validateImmutableDeploymentEvidenceV2(fixture({ projectId: 'prj_other', name: 'other-app' }));
  assert.equal(r.verified, false); assert.ok(r.violations.includes('project_id_mismatch')); assert.ok(r.violations.includes('project_name_mismatch'));
});
test('rejects same commit from another repository', () => {
  const r = validateImmutableDeploymentEvidenceV2(fixture({ gitSource: { type: 'github', repoId: 999, ref: 'main', sha: SHA } }));
  assert.equal(r.verified, false); assert.ok(r.violations.includes('repo_id_mismatch'));
});
test('rejects branch/ref mismatch', () => {
  const r = validateImmutableDeploymentEvidenceV2(fixture({ gitSource: { type: 'github', repoId: 1003910384, ref: 'feature', sha: SHA } }));
  assert.equal(r.verified, false); assert.ok(r.violations.includes('ref_mismatch'));
});
test('fails closed when expected identity is incomplete', () => {
  const f = fixture(); delete f.expected.project_id; const r = validateImmutableDeploymentEvidenceV2(f);
  assert.equal(r.verified, false); assert.ok(r.violations.includes('expected_project_id_missing'));
});
test('canonical digest is stable across expected key order', () => {
  const left = validateImmutableDeploymentEvidenceV2(fixture()); const f = fixture();
  f.expected = { ref: 'main', repo_id: 1003910384, project_name: 'mirror-cartographer-ui', project_id: 'prj_expected', commit_sha: SHA };
  assert.equal(left.sha256, validateImmutableDeploymentEvidenceV2(f).sha256);
});
