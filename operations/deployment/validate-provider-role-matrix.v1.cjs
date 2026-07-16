'use strict';

const fs = require('node:fs');

const REQUIRED_NON_SUCCESS_STATES = new Set([
  'absent', 'queued', 'building', 'canceled', 'skipped', 'superseded',
  'rate_limited', 'stale', 'commit_mismatched', 'branch_mismatched',
  'repository_mismatched', 'project_mismatched', 'authority_unresolved',
  'failed', 'error', 'unknown'
]);

const AUTHORITATIVE = new Set(['canonical', 'authoritative']);
const BLOCKED = new Set(['blocked', 'blocked_pending_reconciliation', 'none']);

function validateProviderRoleMatrix(matrix) {
  const errors = [];
  if (!matrix || typeof matrix !== 'object') return { ok: false, errors: ['matrix must be an object'] };
  if (!matrix.providers || typeof matrix.providers !== 'object') errors.push('providers must be an object');

  const providers = Object.entries(matrix.providers || {});
  const authoritative = providers.filter(([, p]) => AUTHORITATIVE.has(p.publication_authority));
  const ambiguous = providers.filter(([, p]) => !AUTHORITATIVE.has(p.publication_authority) && !BLOCKED.has(p.publication_authority) && p.publication_authority !== 'declared_but_not_runtime_verified');

  if (authoritative.length > 1) errors.push(`multiple canonical publishers: ${authoritative.map(([name]) => name).join(', ')}`);
  if (ambiguous.length) errors.push(`unknown publication_authority values: ${ambiguous.map(([name, p]) => `${name}=${p.publication_authority}`).join(', ')}`);

  if (matrix.current_decision === 'allow_publication_or_promotion' && authoritative.length !== 1) {
    errors.push('publication requires exactly one authoritative provider');
  }
  if (matrix.current_decision === 'block_publication_and_promotion' && authoritative.length > 0) {
    errors.push('blocked decision conflicts with an authoritative provider');
  }

  const observedStates = new Set(matrix.global_non_success_states || []);
  for (const state of REQUIRED_NON_SUCCESS_STATES) {
    if (!observedStates.has(state)) errors.push(`missing non-success state: ${state}`);
  }

  for (const [name, provider] of providers) {
    if (!provider.declared_role) errors.push(`${name} missing declared_role`);
    if (!provider.publication_authority) errors.push(`${name} missing publication_authority`);
    if (!Array.isArray(provider.success_requires) || provider.success_requires.length === 0) {
      errors.push(`${name} missing success_requires`);
    }
  }

  if (typeof matrix.rollback_route !== 'string' || matrix.rollback_route.trim().length < 20) {
    errors.push('rollback_route must be substantive');
  }

  return { ok: errors.length === 0, errors, authoritative_providers: authoritative.map(([name]) => name) };
}

if (require.main === module) {
  const path = process.argv[2] || 'operations/deployment/PROVIDER_ROLE_MATRIX.json';
  const matrix = JSON.parse(fs.readFileSync(path, 'utf8'));
  const result = validateProviderRoleMatrix(matrix);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.ok ? 0 : 1;
}

module.exports = { validateProviderRoleMatrix };
