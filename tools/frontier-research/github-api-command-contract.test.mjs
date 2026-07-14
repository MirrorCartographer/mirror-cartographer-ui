import test from 'node:test';
import assert from 'node:assert/strict';
import { assessGitHubApiCommandContract } from './github-api-command-contract.mjs';

const validCommand = "gh api --paginate --slurp -H 'X-GitHub-Api-Version: 2026-03-10' repos/{owner}/{repo}/actions/runs -f head_sha=abc123 -f per_page=100";

test('accepts an explicitly versioned exhaustive exact-commit command', () => {
  const result = assessGitHubApiCommandContract({
    command: validCommand,
    requestedVersion: '2026-03-10'
  });

  assert.equal(result.verified, true);
  assert.deepEqual(result.reasons, []);
});

test('rejects a command that relies on the server default API version', () => {
  const result = assessGitHubApiCommandContract({
    command: "gh api --paginate --slurp repos/{owner}/{repo}/actions/runs -f head_sha=abc123 -f per_page=100",
    requestedVersion: '2026-03-10'
  });

  assert.equal(result.verified, false);
  assert.ok(result.reasons.includes('explicit_version_header_missing_or_mismatched'));
});

test('rejects a mismatched version header', () => {
  const result = assessGitHubApiCommandContract({
    command: validCommand,
    requestedVersion: '2022-11-28'
  });

  assert.equal(result.verified, false);
  assert.ok(result.reasons.includes('explicit_version_header_missing_or_mismatched'));
});

test('rejects incomplete pagination and exact-commit filters', () => {
  const result = assessGitHubApiCommandContract({
    command: "gh api -H 'X-GitHub-Api-Version: 2026-03-10' repos/{owner}/{repo}/actions/runs",
    requestedVersion: '2026-03-10'
  });

  assert.deepEqual(result.reasons, [
    'paginate_flag_missing',
    'slurp_flag_missing',
    'head_sha_filter_missing',
    'max_page_size_missing'
  ]);
});

test('rejects a missing retained command', () => {
  const result = assessGitHubApiCommandContract({
    command: '',
    requestedVersion: '2026-03-10'
  });

  assert.deepEqual(result.reasons, ['command_missing']);
});
