'use strict';

const { validateProviderRoleMatrix: validateV1 } = require('./validate-provider-role-matrix.v1.cjs');

const DECISIONS = new Set([
  'block_publication_and_promotion',
  'allow_publication_or_promotion'
]);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateUniqueStringArray(value, label, errors, { nonEmpty = true } = {}) {
  if (!Array.isArray(value) || (nonEmpty && value.length === 0)) {
    errors.push(`${label} must be ${nonEmpty ? 'a non-empty' : 'an'} array`);
    return;
  }
  const seen = new Set();
  value.forEach((item, index) => {
    if (typeof item !== 'string' || item.trim() === '') {
      errors.push(`${label}[${index}] must be a non-empty string`);
      return;
    }
    const normalized = item.trim();
    if (seen.has(normalized)) errors.push(`${label} contains duplicate value: ${normalized}`);
    seen.add(normalized);
  });
}

function validateProviderRoleMatrixV2(matrix) {
  const errors = [];

  if (!isRecord(matrix)) return { ok: false, errors: ['matrix must be an object'], authoritative_providers: [] };
  if (matrix.schema_version !== 2) errors.push('schema_version must equal 2');
  if (!DECISIONS.has(matrix.current_decision)) errors.push(`unknown current_decision: ${String(matrix.current_decision)}`);
  if (!isRecord(matrix.providers) || Object.keys(matrix.providers).length === 0) {
    errors.push('providers must be a non-empty object');
  } else {
    for (const [name, provider] of Object.entries(matrix.providers)) {
      if (!isRecord(provider)) {
        errors.push(`${name} provider entry must be an object`);
        continue;
      }
      validateUniqueStringArray(provider.success_requires, `${name}.success_requires`, errors);
      if (provider.allowed_branches !== undefined) {
        validateUniqueStringArray(provider.allowed_branches, `${name}.allowed_branches`, errors);
      }
      if (provider.declared_role === 'none' && ['canonical', 'authoritative'].includes(provider.publication_authority)) {
        errors.push(`${name} cannot be authoritative while declared_role is none`);
      }
    }
  }

  validateUniqueStringArray(matrix.global_non_success_states, 'global_non_success_states', errors);

  if (errors.length > 0) return { ok: false, errors, authoritative_providers: [] };

  const v1 = validateV1(matrix);
  return { ...v1, validator_version: 2 };
}

module.exports = { validateProviderRoleMatrixV2 };
