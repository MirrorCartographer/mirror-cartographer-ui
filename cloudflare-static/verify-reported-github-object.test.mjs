import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyReportedObject } from './verify-reported-github-object.mjs';

const report = {
  repository: 'MirrorCartographer/mirror-cartographer-ui',
  commit_sha: 'a'.repeat(40),
  path: 'cloudflare-static/example.mjs'
};

const observed = {
  repository: report.repository,
  commit_sha: report.commit_sha,
  commit_status: 'found',
  path: report.path,
  path_status: 'found',
  observed_at: '2026-07-13T04:57:37Z',
  source: 'github_connector'
};

test('accepts only an exact observed repository, commit, and path', () => {
  const result = classifyReportedObject({ report, observed });
  assert.equal(result.verified, true);
  assert.deepEqual(result.failures, []);
});

test('fails closed when the reported commit is absent', () => {
  const result = classifyReportedObject({
    report,
    observed: { ...observed, commit_status: 'not_found', commit_sha: null }
  });
  assert.equal(result.verified, false);
  assert.ok(result.failures.includes('commit_not_found'));
});

test('fails closed when the reported path is absent', () => {
  const result = classifyReportedObject({
    report,
    observed: { ...observed, path_status: 'not_found' }
  });
  assert.equal(result.verified, false);
  assert.ok(result.failures.includes('path_not_found'));
});

test('rejects malformed commit identifiers', () => {
  const result = classifyReportedObject({
    report: { ...report, commit_sha: 'not-a-sha' },
    observed
  });
  assert.equal(result.verified, false);
  assert.ok(result.failures.includes('invalid_reported_commit_sha'));
  assert.ok(result.failures.includes('observed_commit_mismatch'));
});

test('rejects cross-repository substitution', () => {
  const result = classifyReportedObject({
    report,
    observed: { ...observed, repository: 'other/repository' }
  });
  assert.equal(result.verified, false);
  assert.ok(result.failures.includes('repository_mismatch'));
});
