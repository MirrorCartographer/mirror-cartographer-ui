'use strict';

const { validateAdversarialCycle: validateV2 } = require('./validateAdversarialCycle.v2.cjs');

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateTransitionIntegrity(transition, fromPhase, toPhase, violations) {
  if (!transition || !Array.isArray(transition.uncertainty_dispositions)) return;
  const prior = new Set(Array.isArray(fromPhase?.remaining_uncertainty) ? fromPhase.remaining_uncertainty : []);
  const next = new Set(Array.isArray(toPhase?.remaining_uncertainty) ? toPhase.remaining_uncertainty : []);

  for (const item of transition.uncertainty_dispositions) {
    if (!item || !nonEmptyString(item.uncertainty)) continue;
    const label = `${fromPhase.checkpoint}->${toPhase.checkpoint}:${item.uncertainty}`;

    if (!prior.has(item.uncertainty)) {
      violations.push(`orphan_uncertainty_disposition:${label}`);
      continue;
    }

    if ((item.outcome === 'repaired' || item.outcome === 'rejected') && next.has(item.uncertainty)) {
      violations.push(`${item.outcome}_uncertainty_still_active:${label}`);
    }
  }
}

function validateAdversarialCycle(cycle) {
  const normalized = cycle && typeof cycle === 'object' && !Array.isArray(cycle)
    ? { ...cycle, schema_version: 2 }
    : cycle;
  const base = validateV2(normalized);
  const violations = base.violations.filter((entry) => entry !== 'schema_version_must_be_2');

  if (!cycle || typeof cycle !== 'object' || Array.isArray(cycle)) {
    return { valid: false, violations: ['cycle_must_be_object'] };
  }
  if (cycle.schema_version !== 3) violations.push('schema_version_must_be_3');

  if (Array.isArray(cycle.phases) && cycle.phases.length === 3 && Array.isArray(cycle.transitions) && cycle.transitions.length === 2) {
    validateTransitionIntegrity(cycle.transitions[0], cycle.phases[0], cycle.phases[1], violations);
    validateTransitionIntegrity(cycle.transitions[1], cycle.phases[1], cycle.phases[2], violations);
  }

  return { valid: violations.length === 0, violations: [...new Set(violations)] };
}

module.exports = { validateAdversarialCycle, validateTransitionIntegrity };
