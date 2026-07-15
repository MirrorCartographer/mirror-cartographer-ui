'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateGitHubWorkflowPaginationUrl } = require('./validateGitHubWorkflowPaginationUrlPolicy.v1.cjs');

const SHA = 'a'.repeat(40);
const CONTEXT = { exact_commit: SHA, repository: 'MirrorCartographer/mirror-cartographer-ui' };
const base = `https://api.github.com/repos/MirrorCartographer/mirror-cartographer-ui/actions/runs?head_sha=${SHA}&per_page=100`;

test('accepts the exact repository Actions endpoint with immutable commit filter', () => {
  const result = validateGitHubWorkflowPaginationUrl(base + '&page=2', CONTEXT);
  assert.equal(result.verified, true);
  assert.equal(result.trust_boundary, 'github_api_exact_commit_actions_runs');
});

test('rejects a cross-origin next URL', () => {
  const result = validateGitHubWorkflowPaginationUrl(base.replace('api.github.com', 'example.invalid'), CONTEXT);
  assert.equal(result.verified, false);
  assert.ok(result.reasons.includes('unexpected_api_origin'));
});

test('rejects a different repository or endpoint path', () => {
  const result = validateGitHubWorkflowPaginationUrl(base.replace('mirror-cartographer-ui/actions/runs', 'other/actions/artifacts'), CONTEXT);
  assert.equal(result.verified, false);
  assert.ok(result.reasons.includes('unexpected_endpoint_path'));
});

test('rejects changed, absent, or duplicated exact-commit filters', () => {
  const changed = validateGitHubWorkflowPaginationUrl(base.replace(SHA, 'b'.repeat(40)), CONTEXT);
  const absent = validateGitHubWorkflowPaginationUrl(base.replace(`head_sha=${SHA}&`, ''), CONTEXT);
  const duplicated = validateGitHubWorkflowPaginationUrl(base + `&head_sha=${SHA}`, CONTEXT);
  assert.ok(changed.reasons.includes('exact_commit_filter_mismatch'));
  assert.ok(absent.reasons.includes('exact_commit_filter_mismatch'));
  assert.ok(duplicated.reasons.includes('duplicate_query_parameter_head_sha'));
});

test('rejects non-maximal page size and unsupported filters that narrow enumeration', () => {
  const small = validateGitHubWorkflowPaginationUrl(base.replace('per_page=100', 'per_page=30'), CONTEXT);
  const narrowed = validateGitHubWorkflowPaginationUrl(base + '&event=push', CONTEXT);
  assert.ok(small.reasons.includes('per_page_not_100'));
  assert.ok(narrowed.reasons.includes('unsupported_query_parameter_event'));
});

test('rejects URL userinfo, fragments, and invalid page numbers', () => {
  const userinfo = validateGitHubWorkflowPaginationUrl(base.replace('https://', 'https://token@'), CONTEXT);
  const fragment = validateGitHubWorkflowPaginationUrl(base + '#secret', CONTEXT);
  const pageZero = validateGitHubWorkflowPaginationUrl(base + '&page=0', CONTEXT);
  assert.ok(userinfo.reasons.includes('userinfo_forbidden'));
  assert.ok(fragment.reasons.includes('fragment_forbidden'));
  assert.ok(pageZero.reasons.includes('invalid_page_number'));
});
