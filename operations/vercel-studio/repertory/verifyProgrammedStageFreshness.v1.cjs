'use strict';

function verifyProgrammedStageFreshness(receipt, now, options = {}) {
  const violations = [];
  const maxAgeMs = Number.isFinite(options.max_age_ms) ? options.max_age_ms : 60 * 60 * 1000;

  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    violations.push('invalid_receipt');
  }
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    violations.push('invalid_now');
  }
  if (!Number.isFinite(maxAgeMs) || maxAgeMs <= 0 || maxAgeMs > 60 * 60 * 1000) {
    violations.push('invalid_max_age');
  }

  let generatedAt = null;
  if (violations.length === 0) {
    generatedAt = new Date(receipt.generated_at);
    if (Number.isNaN(generatedAt.getTime())) violations.push('invalid_generated_at');
    if (receipt.runtime_activation_claimed !== false) violations.push('runtime_activation_claimed');
    if (receipt.deployment_claimed !== false) violations.push('deployment_claimed');
    if (receipt.side_effects_performed !== false) violations.push('side_effects_claimed');
  }

  if (generatedAt && !Number.isNaN(generatedAt.getTime()) && now instanceof Date && !Number.isNaN(now.getTime())) {
    const ageMs = now.getTime() - generatedAt.getTime();
    if (ageMs < 0) violations.push('receipt_from_future');
    if (ageMs >= maxAgeMs) violations.push('receipt_stale');
    if (receipt.utc_hour !== now.getUTCHours()) violations.push('programmed_hour_mismatch');
  }

  return Object.freeze({
    schema_version: 1,
    verified: violations.length === 0,
    max_age_ms: maxAgeMs,
    violations: Object.freeze([...new Set(violations)].sort()),
    claim_boundary: violations.length === 0
      ? 'fresh_programmed_stage_identity_only'
      : 'current_stage_claim_prohibited',
  });
}

module.exports = { verifyProgrammedStageFreshness };
