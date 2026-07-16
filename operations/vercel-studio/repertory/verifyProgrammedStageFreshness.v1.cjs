'use strict';

const { verifyProgrammedStageReceipt } = require('./verifyProgrammedStageReceipt.v1.cjs');

function verifyProgrammedStageFreshness(receipt, now, options = {}) {
  const violations = [];
  const maxAgeMs = Number.isFinite(options.max_age_ms) ? options.max_age_ms : 60 * 60 * 1000;
  const expected = options.expected && typeof options.expected === 'object'
    ? options.expected
    : {};

  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    violations.push('invalid_receipt');
  }
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    violations.push('invalid_now');
  }
  if (!Number.isFinite(maxAgeMs) || maxAgeMs <= 0 || maxAgeMs > 60 * 60 * 1000) {
    violations.push('invalid_max_age');
  }

  let structural = null;
  let generatedAt = null;
  if (violations.length === 0) {
    structural = verifyProgrammedStageReceipt(receipt, expected);
    if (!structural.verified) {
      violations.push('receipt_contract_unverified');
      for (const violation of structural.violations) {
        violations.push(`receipt_contract:${violation}`);
      }
    }

    generatedAt = new Date(receipt.generated_at);
  }

  if (
    generatedAt
    && !Number.isNaN(generatedAt.getTime())
    && now instanceof Date
    && !Number.isNaN(now.getTime())
  ) {
    const ageMs = now.getTime() - generatedAt.getTime();
    if (ageMs < 0) violations.push('receipt_from_future');
    if (ageMs >= maxAgeMs) violations.push('receipt_stale');
    if (receipt.utc_hour !== now.getUTCHours()) violations.push('programmed_hour_mismatch');
  }

  const uniqueViolations = [...new Set(violations)].sort();

  return Object.freeze({
    schema_version: 1,
    verified: uniqueViolations.length === 0,
    max_age_ms: maxAgeMs,
    receipt_contract_verified: structural?.verified === true,
    violations: Object.freeze(uniqueViolations),
    claim_boundary: uniqueViolations.length === 0
      ? 'fresh_commit_and_repertory_bound_programmed_stage_identity_only'
      : 'current_stage_claim_prohibited',
  });
}

module.exports = { verifyProgrammedStageFreshness };
