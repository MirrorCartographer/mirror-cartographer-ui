'use strict';

const { verifyRuntimeStageFreshnessV2 } = require('./verifyRuntimeStageFreshness.v2.cjs');

function nextUtcHourBoundary(date) {
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours() + 1,
    0,
    0,
    0,
  ));
}

function verifyRuntimeStageFreshnessV3(input) {
  const verified = verifyRuntimeStageFreshnessV2(input);
  const observedAt = new Date(verified.observed_at);
  const checkedAt = new Date(verified.checked_at);
  const stageExpiresAt = nextUtcHourBoundary(observedAt);

  if (checkedAt.getTime() >= stageExpiresAt.getTime()) {
    throw new Error('stage verification belongs to a previous deterministic repertory hour');
  }

  return Object.freeze({
    ...verified,
    contract_id: 'vercel-studio-runtime-stage-freshness-v3',
    classification: 'commit_bound_runtime_stage_fresh_current_hour',
    repertory_hour_utc: observedAt.getUTCHours(),
    stage_expires_at: stageExpiresAt.toISOString(),
  });
}

module.exports = {
  nextUtcHourBoundary,
  verifyRuntimeStageFreshnessV3,
};
