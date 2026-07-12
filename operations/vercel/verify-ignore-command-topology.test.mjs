import assert from 'node:assert/strict';
import test from 'node:test';

import { auditIgnoreCommandSource } from './verify-ignore-command-topology.mjs';

test('rejects first-parent-only changed-path discovery', () => {
  const source = "execFileSync('git', ['diff', '--name-only', 'HEAD^', 'HEAD'])";
  const result = auditIgnoreCommandSource(source);
  assert.equal(result.valid, false);
  assert.deepEqual(result.risks, ['single-parent-diff-can-miss-merge-parent-changes']);
});

test('accepts merge-aware diff-tree discovery', () => {
  const source = "execFileSync('git', ['diff-tree', '--no-commit-id', '--name-only', '-r', '-m', 'HEAD'])";
  assert.equal(auditIgnoreCommandSource(source).valid, true);
});

test('fails closed when no merge-aware replacement is present', () => {
  assert.equal(auditIgnoreCommandSource('git diff --name-only HEAD^ HEAD').valid, false);
});
