'use strict';

const { validateAdversarialCycle: validateV4 } = require('./validateAdversarialCycle.v4.cjs');
const { validateEvidenceItem } = require('./validateAdversarialPhaseRecord.v4.cjs');

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function evidenceByLocator(phase) {
  const items = Array.isArray(phase?.evidence_inspected) ? phase.evidence_inspected : [];
  return new Map(items
    .filter((item) => item && nonEmptyString(item.locator))
    .map((item) => [item.locator, item]));
}

function validateClosureEvidence(transition, toPhase, violations) {
  if (!transition || !Array.isArray(transition.uncertainty_dispositions)) return;
  const evidence = evidenceByLocator(toPhase);

  for (const item of transition.uncertainty_dispositions) {
    if (!item || !nonEmptyString(item.uncertainty)) continue;
    if (item.outcome !== 'repaired' && item.outcome !== 'rejected') continue;

    const boundary = `${transition.from}->${transition.to}:${item.uncertainty}`;
    if (!nonEmptyString(item.evidence_reference_locator)) {
      violations.push(`closure_missing_evidence_reference:${boundary}`);
      continue;
    }

    const referenced = evidence.get(item.evidence_reference_locator);
    if (!referenced) {
      violations.push(`closure_evidence_reference_not_in_next_phase:${boundary}`);
      continue;
    }

    validateEvidenceItem(referenced).forEach((violation) => {
      violations.push(`closure_evidence_invalid:${boundary}:${violation}`);
    });

    const expectedClaim = `${item.outcome.toUpperCase()} ${item.uncertainty}`;
    if (!nonEmptyString(referenced.claim_supported) || !referenced.claim_supported.startsWith(expectedClaim)) {
      violations.push(`closure_evidence_claim_mismatch:${boundary}`);
    }

    if (referenced.strength === 'lead_only') {
      violations.push(`closure_cannot_rely_on_lead_only_evidence:${boundary}`);
    }
  }
}

function validateAdversarialCycle(cycle) {
  const normalized = cycle && typeof cycle === 'object' && !Array.isArray(cycle)
    ? { ...cycle, schema_version: 4 }
    : cycle;
  const base = validateV4(normalized);
  const violations = base.violations.filter((entry) => entry !== 'schema_version_must_be_4');

  if (!cycle || typeof cycle !== 'object' || Array.isArray(cycle)) {
    return { valid: false, violations: ['cycle_must_be_object'] };
  }
  if (cycle.schema_version !== 5) violations.push('schema_version_must_be_5');

  if (Array.isArray(cycle.phases) && cycle.phases.length === 3 && Array.isArray(cycle.transitions) && cycle.transitions.length === 2) {
    validateClosureEvidence(cycle.transitions[0], cycle.phases[1], violations);
    validateClosureEvidence(cycle.transitions[1], cycle.phases[2], violations);
  }

  return { valid: violations.length === 0, violations: [...new Set(violations)] };
}

module.exports = { validateAdversarialCycle, validateClosureEvidence };
