'use strict';

const { validateRecord: validateV3 } = require('./validate-adversarial-review.v3.cjs');

const CHALLENGE_ID_PATTERN = /^[a-z][a-z0-9_-]{2,63}$/;

function normalizeEvidence(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

function validateRecord(record) {
  const base = validateV3(record);
  const errors = [...base.errors];

  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { valid: false, errors: [...new Set(errors)] };
  }

  if (Array.isArray(record.rejected_alternatives) && record.rejected_alternatives.length === 0) {
    errors.push('rejected_alternatives must contain at least one item');
  }

  const challengeIds = new Set();

  if (Array.isArray(record.phases)) {
    record.phases.forEach((phase, phaseIndex) => {
      if (!phase || typeof phase !== 'object' || Array.isArray(phase)) return;

      if (typeof phase.challenge_id !== 'string' || !CHALLENGE_ID_PATTERN.test(phase.challenge_id)) {
        errors.push(`phase ${phaseIndex} challenge_id must match ${CHALLENGE_ID_PATTERN}`);
      } else if (challengeIds.has(phase.challenge_id)) {
        errors.push(`phase ${phaseIndex} challenge_id must be unique`);
      } else {
        challengeIds.add(phase.challenge_id);
      }

      if (Array.isArray(phase.evidence)) {
        const seenEvidence = new Set();
        phase.evidence.forEach((item, evidenceIndex) => {
          const normalized = normalizeEvidence(item);
          if (seenEvidence.has(normalized)) {
            errors.push(`phase ${phaseIndex} evidence[${evidenceIndex}] duplicates earlier evidence`);
          }
          seenEvidence.add(normalized);
        });
      }

      if (!Array.isArray(phase.outcome_evidence_refs) || phase.outcome_evidence_refs.length === 0) {
        errors.push(`phase ${phaseIndex} outcome_evidence_refs must contain at least one evidence index`);
        return;
      }

      const seenRefs = new Set();
      phase.outcome_evidence_refs.forEach((ref, refIndex) => {
        if (!Number.isInteger(ref) || ref < 0) {
          errors.push(`phase ${phaseIndex} outcome_evidence_refs[${refIndex}] must be a non-negative integer`);
          return;
        }
        if (seenRefs.has(ref)) {
          errors.push(`phase ${phaseIndex} outcome_evidence_refs[${refIndex}] duplicates an earlier reference`);
        }
        seenRefs.add(ref);
        if (!Array.isArray(phase.evidence) || ref >= phase.evidence.length) {
          errors.push(`phase ${phaseIndex} outcome_evidence_refs[${refIndex}] is out of range`);
        }
      });
    });
  }

  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

module.exports = {
  CHALLENGE_ID_PATTERN,
  validateRecord,
};
