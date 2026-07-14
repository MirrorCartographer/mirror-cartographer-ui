import { createCurrentStageReceipt } from './current-stage-receipt.mjs';
import { assessStageTimeCoherence, deriveCivilHour } from './stage-time-coherence.mjs';

export function createPromotableStageEvidence({ observed_at, timezone, continuity_id, continuity_revision } = {}) {
  const civilHour = deriveCivilHour({ observed_at, timezone });
  const receipt = createCurrentStageReceipt({
    hour: civilHour,
    observed_at,
    timezone,
    continuity_id,
    continuity_revision,
  });
  const coherence = assessStageTimeCoherence(receipt);
  if (coherence.verified !== true) {
    const error = new Error(`Stage evidence promotion rejected: ${coherence.reasons.join(',') || 'unverified'}.`);
    error.code = 'STAGE_EVIDENCE_UNVERIFIED';
    error.coherence = coherence;
    throw error;
  }
  return Object.freeze({
    schema_version: 1,
    promotable: true,
    receipt,
    coherence,
  });
}
