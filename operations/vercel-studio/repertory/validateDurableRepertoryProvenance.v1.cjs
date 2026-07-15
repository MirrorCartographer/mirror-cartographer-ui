'use strict';

const TRANSIENT_PATTERNS = [
  /\bcurrent(?:ly)?\s+(?:stage|hour|production|selection|selected)\b/i,
  /\bselected\s+for\s+UTC\s+hour\s+\d{1,2}\b/i,
  /\bon\s+stage\s+(?:now|today|this\s+hour)\b/i,
  /\bproduction\s+currently\s+on\s+stage\b/i,
];

function validateDurableRepertoryProvenance(repertory) {
  if (!repertory || typeof repertory !== 'object' || Array.isArray(repertory)) {
    throw new TypeError('repertory must be an object');
  }
  if (!Array.isArray(repertory.productions) || repertory.productions.length === 0) {
    throw new Error('repertory.productions must be a non-empty array');
  }

  const violations = [];
  const seenIds = new Set();

  for (const [index, production] of repertory.productions.entries()) {
    if (!production || typeof production !== 'object' || Array.isArray(production)) {
      violations.push({ index, code: 'invalid_production', field: null });
      continue;
    }

    const id = production.id;
    if (typeof id !== 'string' || id.length === 0) {
      violations.push({ index, code: 'missing_production_id', field: 'id' });
    } else if (seenIds.has(id)) {
      violations.push({ index, production_id: id, code: 'duplicate_production_id', field: 'id' });
    } else {
      seenIds.add(id);
    }

    const provenance = production.provenance;
    if (!provenance || typeof provenance !== 'object' || Array.isArray(provenance)) {
      violations.push({ index, production_id: id ?? null, code: 'missing_provenance', field: 'provenance' });
      continue;
    }

    for (const field of ['inferred', 'experiment', 'current_decision']) {
      const value = provenance[field];
      if (typeof value !== 'string' || value.trim().length === 0) {
        violations.push({ index, production_id: id ?? null, code: 'missing_provenance_field', field });
        continue;
      }
      if (TRANSIENT_PATTERNS.some((pattern) => pattern.test(value))) {
        violations.push({ index, production_id: id ?? null, code: 'transient_stage_claim_in_durable_provenance', field });
      }
    }

    if (!Array.isArray(provenance.observed)) {
      violations.push({ index, production_id: id ?? null, code: 'observed_must_be_array', field: 'observed' });
    }
  }

  return {
    schema_version: 1,
    evidence_class: 'durable_repertory_provenance_validation',
    valid: violations.length === 0,
    production_count: repertory.productions.length,
    violations,
    activation_claimed: false,
    deployment_claimed: false,
  };
}

module.exports = { validateDurableRepertoryProvenance };
