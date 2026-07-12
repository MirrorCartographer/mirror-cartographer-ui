import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyReportedArtifacts } from './reported-artifact-verifier.mjs';

const sha = 'a'.repeat(40);
const report = { report_id: 'CM-prior', artifacts: [{ path: 'tools/continuity-mining/gate.mjs', commit: sha }] };

test('verifies only when path and commit are both observed', () => {
  const result = verifyReportedArtifacts({ report, observedFiles: [report.artifacts[0].path], observedCommits: [sha] });
  assert.equal(result.verified, true);
  assert.equal(result.classification, 'reported_artifacts_verified');
});

test('fails closed when file is absent', () => {
  const result = verifyReportedArtifacts({ report, observedFiles: [], observedCommits: [sha] });
  assert.equal(result.verified, false);
  assert.equal(result.findings[0].status, 'unverified_report');
});

test('fails closed when commit is absent', () => {
  const result = verifyReportedArtifacts({ report, observedFiles: [report.artifacts[0].path], observedCommits: [] });
  assert.equal(result.verified, false);
});

test('rejects malformed commit identifiers', () => {
  assert.throws(() => verifyReportedArtifacts({ report: { artifacts: [{ path: 'x', commit: 'abc' }] } }), /40-character SHA/);
});
