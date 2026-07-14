import { selectHourlyProduction, validateRepertory } from './hourly-repertory-selector.mjs';

const PROVENANCE_CLASSES = Object.freeze(['observed', 'inferred', 'experiment', 'current_decision']);
const PRIVATE_KEYS = /(?:health|diagnos|credential|secret|token|email|payment|conversion|private_source)/i;

function assertPlainObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be a plain object`);
}

function assertPublicValue(value, path = 'manifest') {
  if (typeof value === 'string' && PRIVATE_KEYS.test(value)) throw new Error(`${path} contains prohibited private or conversion language`);
  if (Array.isArray(value)) return value.forEach((entry, index) => assertPublicValue(entry, `${path}[${index}]`));
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      if (PRIVATE_KEYS.test(key)) throw new Error(`${path}.${key} is prohibited`);
      assertPublicValue(entry, `${path}.${key}`);
    }
  }
}

function normalizeProvenance(provenance) {
  assertPlainObject(provenance, 'production.provenance');
  const normalized = {};
  for (const category of PROVENANCE_CLASSES) {
    const value = provenance[category];
    if (category === 'current_decision') {
      if (typeof value !== 'string' || !value.trim()) throw new Error('current_decision must be a non-empty string');
      normalized[category] = value.trim();
    } else {
      if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== 'string' || !item.trim())) {
        throw new Error(`${category} must be a non-empty array of non-empty strings`);
      }
      normalized[category] = value.map((item) => item.trim());
    }
  }
  return Object.freeze(normalized);
}

export function createHourlyStageManifest({ schedule, instant, continuityState }) {
  assertPlainObject(schedule, 'schedule');
  assertPlainObject(continuityState, 'continuityState');
  const validation = validateRepertory(schedule.productions);
  if (schedule.continuity_channel !== validation.continuity_channel) throw new Error('schedule continuity channel does not match production continuity channel');
  if (continuityState.channel !== validation.continuity_channel) throw new Error('continuity state channel mismatch');
  if (typeof continuityState.revision !== 'string' || !continuityState.revision.trim()) throw new Error('continuity state revision is required');

  const selected = selectHourlyProduction({ repertory: schedule.productions, instant, timeZone: schedule.time_zone });
  const production = selected.production;
  const manifest = {
    schema_version: 1,
    selector: selected.selector,
    resolved_hour: selected.resolved_hour,
    time_zone: selected.time_zone,
    production: {
      id: production.id,
      title: production.title,
      form: production.form,
      motion: production.motion,
      sound: production.sound,
      autoplay: false,
      mobile_safe: true,
      accessible: true,
      reversible: true
    },
    continuity: {
      channel: continuityState.channel,
      revision: continuityState.revision.trim()
    },
    provenance: normalizeProvenance(production.provenance),
    privacy_boundary: schedule.privacy_boundary
  };
  assertPublicValue(manifest);
  return Object.freeze(manifest);
}
