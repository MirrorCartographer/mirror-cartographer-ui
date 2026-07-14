import { createHash } from 'node:crypto';
import { getProductionForHour } from './public-repertory-catalog.mjs';

function requireText(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} must be a non-empty string.`);
  return value.trim();
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * Produces a public-safe, deterministic receipt for the hourly repertory stage.
 * The caller supplies the civil hour explicitly so timezone interpretation stays
 * outside the artifact and can be retained with deployment evidence.
 */
export function createCurrentStageReceipt({
  hour,
  observed_at,
  timezone,
  continuity_id = 'mirror-cartographer-public-continuity',
  continuity_revision = '1',
} = {}) {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new RangeError('hour must be an integer from 0 through 23.');
  const observedAt = new Date(observed_at);
  if (Number.isNaN(observedAt.getTime())) throw new TypeError('observed_at must resolve to a valid date.');

  const production = getProductionForHour(hour);
  const body = Object.freeze({
    schema_version: 1,
    observed_at: observedAt.toISOString(),
    civil_hour: hour,
    timezone: requireText(timezone, 'timezone'),
    continuity: Object.freeze({
      id: requireText(continuity_id, 'continuity_id'),
      revision: requireText(continuity_revision, 'continuity_revision'),
    }),
    production: Object.freeze({
      id: production.id,
      title: production.title,
      renderer: production.renderer,
      synopsis: production.synopsis,
      audio_policy: production.audio_policy,
      motion_policy: production.motion_policy,
    }),
    guarantees: Object.freeze({
      deterministic: true,
      autoplay: false,
      private_source_material_included: false,
      reversible: true,
    }),
    provenance_classes: Object.freeze(production.provenance.map((claim) => claim.class)),
  });

  return Object.freeze({
    ...body,
    sha256: createHash('sha256').update(canonicalJson(body)).digest('hex'),
  });
}
