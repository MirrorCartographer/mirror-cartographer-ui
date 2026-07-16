'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateProviderRoleMatrix } = require('./validate-provider-role-matrix.v1.cjs');

const base = {
  schema_version: 2,
  providers: {
    vercel: { declared_role: 'promotion', publication_authority: 'declared_but_not_runtime_verified', success_requires: ['commit'] },
    github_pages: { declared_role: 'publisher', publication_authority: 'blocked_pending_reconciliation', success_requires: ['workflow'] },
    cloudflare: { declared_role: 'none', publication_authority: 'blocked', success_requires: ['identity'] }
  },
  global_non_success_states: [
    'absent', 'queued', 'building', 'canceled', 'skipped', 'superseded',
    'rate_limited', 'stale', 'commit_mismatched', 'branch_mismatched',
    'repository_mismatched', 'project_mismatched', 'authority_unresolved',
    'failed', 'error', 'unknown'
  ],
  current_decision: 'block_publication_and_promotion',
  rollback_route: 'Revert the policy-only commit; no provider state is mutated.'
};

const clone = (value) => JSON.parse(JSON.stringify(value));

test('accepts a fail-closed matrix with no authoritative publisher', () => {
  assert.equal(validateProviderRoleMatrix(clone(base)).ok, true);
});

test('rejects two authoritative publishers', () => {
  const matrix = clone(base);
  matrix.current_decision = 'allow_publication_or_promotion';
  matrix.providers.vercel.publication_authority = 'canonical';
  matrix.providers.github_pages.publication_authority = 'authoritative';
  const result = validateProviderRoleMatrix(matrix);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /multiple canonical publishers/);
});

test('rejects publication with zero authoritative publishers', () => {
  const matrix = clone(base);
  matrix.current_decision = 'allow_publication_or_promotion';
  const result = validateProviderRoleMatrix(matrix);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /exactly one authoritative provider/);
});

test('rejects blocked decision that silently names an authority', () => {
  const matrix = clone(base);
  matrix.providers.cloudflare.publication_authority = 'canonical';
  const result = validateProviderRoleMatrix(matrix);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /blocked decision conflicts/);
});

test('rejects unknown authority vocabulary', () => {
  const matrix = clone(base);
  matrix.providers.cloudflare.publication_authority = 'backup-ish';
  const result = validateProviderRoleMatrix(matrix);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /unknown publication_authority/);
});

test('rejects omission of failed, error, or unknown states', () => {
  for (const missing of ['failed', 'error', 'unknown']) {
    const matrix = clone(base);
    matrix.global_non_success_states = matrix.global_non_success_states.filter((state) => state !== missing);
    const result = validateProviderRoleMatrix(matrix);
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), new RegExp(`missing non-success state: ${missing}`));
  }
});
