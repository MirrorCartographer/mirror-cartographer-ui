/**
 * Forecast Loom: small, local-only probability scoring primitives.
 * A Brier score evaluates a probability forecast against one binary outcome.
 * It is not, by itself, a calibration diagnosis.
 */

export function clampProbability(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new TypeError("probability must be a finite number");
  if (n < 0 || n > 1) throw new RangeError("probability must be between 0 and 1");
  return n;
}

export function validateOutcome(outcome) {
  if (outcome !== 0 && outcome !== 1) {
    throw new RangeError("outcome must be 0 or 1");
  }
  return outcome;
}

export function brierScore(probability, outcome) {
  const p = clampProbability(probability);
  const y = validateOutcome(outcome);
  return (p - y) ** 2;
}

export function meanBrierScore(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new RangeError("at least one scored forecast is required");
  }
  const total = rows.reduce((sum, row) => sum + brierScore(row.probability, row.outcome), 0);
  return total / rows.length;
}

export function probabilityFromCounts(favorable, total) {
  if (!Number.isInteger(favorable) || !Number.isInteger(total) ||
      total < 1 || favorable < 0 || favorable > total) {
    throw new RangeError("counts must be integers with 0 <= favorable <= total and total >= 1");
  }
  return favorable / total;
}

export function drawOutcome(probability, random = Math.random) {
  const p = clampProbability(probability);
  if (typeof random !== "function") throw new TypeError("random must be a function");
  const sample = random();
  if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
    throw new RangeError("random source must return a value in [0, 1)");
  }
  return sample < p ? 1 : 0;
}
