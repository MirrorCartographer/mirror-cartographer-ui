'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateProviderRoleMatrixV2 } = require('./validate-provider-role-matrix.v2.cjs');
const base = {
  schema_version: 2,
  providers: {
    vercel: { declared_role: 'promotion', publication_authority: 'declared_but_not_runtime_verified', allowed_branches: ['preview', 'main'], success_requires: ['commit'] },
    github_pages: { declared_role: 'publisher', publication_authority: 'blocked_pending_reconciliation', success_requires: ['workflow'] },
    cloudflare: { declared_role: 'none', publication_authority: 'blocked', success_requires: ['identity'] }
  },
  global_non_success_states: ['absent','queued','building','canceled','skipped','superseded','rate_limited','stale','commit_mismatched','branch_mismatched','repository_mismatched','project_mismatched','authority_unresolved','failed','error','unknown'],
  current_decision: 'block_publication_and_promotion',
  rollback_route: 'Revert the policy-only commit; no provider state is mutated.'
};
const clone = (v) => JSON.parse(JSON.stringify(v));

test('accepts the current fail-closed contract', () => assert.equal(validateProviderRoleMatrixV2(clone(base)).ok, true));
test('rejects unknown decision vocabulary', () => { const m=clone(base); m.current_decision='block_publication'; const r=validateProviderRoleMatrixV2(m); assert.equal(r.ok,false); assert.match(r.errors.join('\n'),/unknown current_decision/); });
test('rejects missing decision', () => { const m=clone(base); delete m.current_decision; assert.equal(validateProviderRoleMatrixV2(m).ok,false); });
test('rejects unsupported schema version', () => { const m=clone(base); m.schema_version=3; assert.equal(validateProviderRoleMatrixV2(m).ok,false); });
test('rejects malformed provider without throwing', () => { const m=clone(base); m.providers.cloudflare=null; assert.doesNotThrow(()=>validateProviderRoleMatrixV2(m)); assert.equal(validateProviderRoleMatrixV2(m).ok,false); });
test('rejects duplicate success requirements', () => { const m=clone(base); m.providers.vercel.success_requires=['commit','commit']; assert.equal(validateProviderRoleMatrixV2(m).ok,false); });
test('rejects duplicate non-success states', () => { const m=clone(base); m.global_non_success_states.push('unknown'); assert.equal(validateProviderRoleMatrixV2(m).ok,false); });
test('rejects authority-role contradiction', () => { const m=clone(base); m.current_decision='allow_publication_or_promotion'; m.providers.cloudflare.publication_authority='canonical'; assert.equal(validateProviderRoleMatrixV2(m).ok,false); });
