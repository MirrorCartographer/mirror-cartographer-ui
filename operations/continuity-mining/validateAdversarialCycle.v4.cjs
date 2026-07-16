'use strict';

const { validateAdversarialCycle: validateV3 } = require('./validateAdversarialCycle.v3.cjs');

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateClosureSemantics(transition, toPhase, violations) {
  if (!transition || !Array.isArray(transition.uncertainty_dispositions)) return;

  for (const item of transition.uncertainty_dispositions) {
    if (!item || !nonEmptyString(item.uncertainty)) continue;
    const boundary = `${transition.from}->${transition.to}:${item.uncertainty}`;

    if (item.outcome === 'repaired') {
      if (!nonEmptyString(item.repair_reference)) {
        violations.push(`missing_repair_reference:${boundary}`);
        continue;
      }
      if (!Array.isArray(toPhase?.repairs) || !toPhase.repairs.includes(item.repair_reference)) {
        violations.push(`repair_reference_not_in_next_phase:${boundary}`);
      }
      const requiredPrefix = `RESOLVED ${item.uncertainty} :: `;
      if (!item.repair_reference.startsWith(requiredPrefix) || item.repair_reference.length <= requiredPrefix.length) {
        violations.push(`repair_reference_not_explicit_resolution:${boundary}`);
      }
    }

    if (item.outcome === 'rejected') {
      const requiredPrefix = `REJECTED ${item.uncertainty} :: `;
      if (!nonEmptyString(item.evidence) || !item.evidence.startsWith(requiredPrefix) || item.evidence.length <= requiredPrefix.length) {
        violations.push(`rejection_evidence_not_explicit_counterevidence:${boundary}`);
      }
    }
  }
}

function validateAdversarialCycle(cycle) {
  const normalized = cycle && typeof cycle === 'object' && !Array.isArray(cycle)
    ? { ...cycle, schema_version: 3 }
    : cycle;
  const base = validateV3(normalized);
  const violations = base.violations.filter((entry) => entry !== 'schema_version_must_be_3');

  if (!cycle || typeof cycle !== 'object' || Array.isArray(cycle)) {
    return { valid: false, violations: ['cycle_must_be_object'] };
  }
  if (cycle.schema_version !== 4) violations.push('schema_version_must_be_4');

  if (Array.isArray(cycle.phases) && cycle.phases.length === 3 && Array.isArray(cycle.transitions) && cycle.transitions.length === 2) {
    validateClosureSemantics(cycle.transitions[0], cycle.phases[1], violations);
    validateClosureSemantics(cycle.transitions[1], cycle.phases[2], violations);
  }

  return { valid: violations.length === 0, violations: [...new Set(violations)] };
}

module.exports = { validateAdversarialCycle, validateClosureSemantics };
