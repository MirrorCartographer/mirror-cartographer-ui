import { getProductionForHour } from './public-repertory-catalog.mjs';

function requireText(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} must be a non-empty string.`);
  return value.trim();
}

export function deriveCivilHour({ observed_at, timezone } = {}) {
  const observedAt = new Date(observed_at);
  if (Number.isNaN(observedAt.getTime())) throw new TypeError('observed_at must resolve to a valid date.');
  const zone = requireText(timezone, 'timezone');
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat('en-US', { hour: '2-digit', hourCycle: 'h23', timeZone: zone });
  } catch {
    throw new RangeError(`timezone must be a supported IANA time zone: ${zone}.`);
  }
  const hourPart = formatter.formatToParts(observedAt).find((part) => part.type === 'hour');
  const hour = Number(hourPart?.value);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new Error('Unable to derive a valid civil hour.');
  return hour;
}

export function assessStageTimeCoherence(receipt) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) throw new TypeError('receipt must be an object.');
  const derivedHour = deriveCivilHour({ observed_at: receipt.observed_at, timezone: receipt.timezone });
  const expectedProduction = getProductionForHour(derivedHour);
  const declaredProductionId = requireText(receipt.production?.id, 'production.id');
  const declaredHour = receipt.civil_hour;
  const reasons = [];
  if (declaredHour !== derivedHour) reasons.push('civil_hour_mismatch');
  if (declaredProductionId !== expectedProduction.id) reasons.push('production_mismatch');
  return Object.freeze({
    schema_version: 1,
    verified: reasons.length === 0,
    observed_at: new Date(receipt.observed_at).toISOString(),
    timezone: requireText(receipt.timezone, 'timezone'),
    declared_civil_hour: declaredHour,
    derived_civil_hour: derivedHour,
    declared_production_id: declaredProductionId,
    expected_production_id: expectedProduction.id,
    reasons: Object.freeze(reasons),
  });
}
