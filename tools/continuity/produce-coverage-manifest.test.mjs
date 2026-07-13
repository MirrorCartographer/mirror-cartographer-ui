import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCoverageManifest } from './produce-coverage-manifest.mjs';

function fakeGit(outputs, failures = {}) {
  return (_repo, args) => {
    const key = args.join(' ');
    if (failures[key]) throw new Error(failures[key]);
    return outputs[key] ?? '';
  };
}

test('complete traversal retains exact queries and counts', () => {
  const git = fakeGit({
    'symbolic-ref --short refs/remotes/origin/HEAD': 'origin/main',
    'rev-parse main': 'a'.repeat(40),
    'for-each-ref --format=%(refname) %(objectname) refs/heads refs/remotes': `refs/heads/main ${'a'.repeat(40)}`,
    'for-each-ref --format=%(refname) %(objectname) refs/tags': '',
    'rev-list --all': `${'a'.repeat(40)}\n${'b'.repeat(40)}`,
    'rev-list --objects --all': `${'a'.repeat(40)}\n${'b'.repeat(40)} path.txt`,
    'log --all --format=%H -S M-004 --pickaxe-all --name-only': '',
    'log --all --format=%H -S M-005 --pickaxe-all --name-only': '',
    'log --all --format=%H -S M-006 --pickaxe-all --name-only': ''
  });
  const result = buildCoverageManifest({ repositoryFullName: 'o/r', repositoryObjectId: '1', repoPath: '.', git });
  assert.equal(result.manifest.completion_state, 'complete');
  assert.equal(result.manifest.reachable_commit_count, 2);
  assert.deepEqual(result.manifest.queries_utf8.map((entry) => entry.query), ['M-004', 'M-005', 'M-006']);
  assert.match(result.manifest.raw_output_sha256, /^[a-f0-9]{64}$/);
  assert.match(result.manifest.manifest_sha256, /^[a-f0-9]{64}$/);
});

test('traversal failure fails closed as partial', () => {
  const git = fakeGit({
    'symbolic-ref --short refs/remotes/origin/HEAD': 'origin/main',
    'rev-parse main': 'a'.repeat(40)
  }, {
    'rev-list --all': 'history unavailable'
  });
  const result = buildCoverageManifest({ repositoryFullName: 'o/r', repositoryObjectId: '1', repoPath: '.', git });
  assert.equal(result.manifest.completion_state, 'partial');
  assert.ok(result.manifest.traversal_errors.some((entry) => entry.step === 'commits'));
});

test('query bytes are retained as UTF-8 hex', () => {
  const git = fakeGit({
    'symbolic-ref --short refs/remotes/origin/HEAD': 'origin/main',
    'rev-parse main': 'a'.repeat(40)
  });
  const result = buildCoverageManifest({ repositoryFullName: 'o/r', repositoryObjectId: '1', repoPath: '.', git, queries: ['M-004'] });
  assert.equal(result.manifest.queries_utf8[0].hex, '4d2d303034');
});
