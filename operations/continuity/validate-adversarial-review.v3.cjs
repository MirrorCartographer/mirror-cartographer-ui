'use strict';

const { validateRecord: validateV2 } = require('./validate-adversarial-review.v2.cjs');

const SUCCESS_DECISIONS = new Set(['adopt', 'publish', 'canonicalize']);
const COMMIT_TARGET = /^commit:([0-9a-f]{40})$/;

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validateRecord(record) {
  const base = validateV2(record);
  const errors = [...base.errors];

  if (!isObject(record) || !SUCCESS_DECISIONS.has(record.decision)) {
    return { valid: errors.length === 0, errors };
  }

  const match = typeof record.target_digest_or_commit === 'string'
    ? record.target_digest_or_commit.match(COMMIT_TARGET)
    : null;

  if (!match) {
    errors.push(
      `decision ${record.decision} requires target_digest_or_commit in commit:<40 lowercase hex SHA> form`
    );
    return { valid: false, errors };
  }

  const targetCommit = match[1];
  const phases = Array.isArray(record.phases) ? record.phases : [];

  for (const phaseIndex of [1, 2]) {
    const phase = phases[phaseIndex];
    if (!isObject(phase) || !Array.isArray(phase.evidence)) {
      continue;
    }

    const matchingCommitEvidence = phase.evidence.some(
      (item) => isObject(item) && item.commit_sha === targetCommit
    );

    if (!matchingCommitEvidence) {
      errors.push(
        `phase ${phaseIndex} requires retained evidence with commit_sha matching ${targetCommit}`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  COMMIT_TARGET,
  SUCCESS_DECISIONS,
  validateRecord,
};
