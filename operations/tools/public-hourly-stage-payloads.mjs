import { createHourlyStageManifest } from './hourly-stage-manifest.mjs';
import { validatePublicStagePayload } from '../prototypes/hourly-stage-runtime-candidate.mjs';

const PROVENANCE_CLASSES = Object.freeze(['observed', 'inferred', 'experiment', 'current_decision']);
const PROHIBITED = /(?:private_source|credential|secret|token|payment|conversion|checkout|purchase|diagnos|health)/i;

function assertPlainObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be a plain object`);
  }
}

function assertPublicTree(value, path = 'payload') {
  if (typeof value === 'string' && PROHIBITED.test(value)) {
    throw new Error(`${path} contains prohibited private, clinical, or conversion language`);
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertPublicTree(entry, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      if (PROHIBITED.test(key)) throw new Error(`${path}.${key} is prohibited`);
      assertPublicTree(entry, `${path}.${key}`);
    }
  }
}

function normalizeProvenance(provenance) {
  assertPlainObject(provenance, 'manifest.provenance');
  const result = {};
  for (const category of PROVENANCE_CLASSES) {
    const value = provenance[category];
    if (category === 'current_decision') {
      if (typeof value !== 'string' || !value.trim()) throw new Error('current_decision is required');
      result[category] = value.trim();
      continue;
    }
    if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== 'string' || !item.trim())) {
      throw new Error(`${category} must be a non-empty string array`);
    }
    result[category] = value.map((item) => item.trim());
  }
  return Object.freeze(result);
}

export function createPublicHourlyStagePayload(manifest) {
  assertPlainObject(manifest, 'manifest');
  assertPlainObject(manifest.production, 'manifest.production');
  assertPlainObject(manifest.continuity, 'manifest.continuity');

  const payload = {
    schema_version: 1,
    resolved_hour: manifest.resolved_hour,
    time_zone: manifest.time_zone,
    stage: {
      id: manifest.production.id,
      title: manifest.production.title,
      form: manifest.production.form,
      motion: manifest.production.motion,
      sound: manifest.production.sound,
    },
    controls: {
      autoplay: false,
      sound_requires_user_action: true,
      reduced_motion_supported: true,
    },
    continuity: {
      channel: manifest.continuity.channel,
      revision: manifest.continuity.revision,
    },
    provenance: normalizeProvenance(manifest.provenance),
    safety: {
      mobile_safe: manifest.production.mobile_safe === true,
      accessible: manifest.production.accessible === true,
      reversible: manifest.production.reversible === true,
      contains_payment_or_conversion_logic: false,
      contains_private_source_material: false,
    },
  };

  assertPublicTree(payload);
  return validatePublicStagePayload(payload);
}

export function compilePublicHourlyStagePayloads({ schedule, continuityState, hourInstants }) {
  assertPlainObject(schedule, 'schedule');
  assertPlainObject(continuityState, 'continuityState');
  if (!Array.isArray(hourInstants) || hourInstants.length !== 24) {
    throw new Error('hourInstants must contain exactly 24 representative instants');
  }

  const payloads = hourInstants.map((instant, expectedHour) => {
    const manifest = createHourlyStageManifest({ schedule, continuityState, instant });
    if (manifest.resolved_hour !== expectedHour) {
      throw new Error(`hourInstants[${expectedHour}] resolves to hour ${manifest.resolved_hour}`);
    }
    return createPublicHourlyStagePayload(manifest);
  });

  const ids = new Set(payloads.map((payload) => payload.stage.id));
  const channels = new Set(payloads.map((payload) => payload.continuity.channel));
  const hours = payloads.map((payload) => payload.resolved_hour);
  if (ids.size !== 24) throw new Error('compiled repertory must contain 24 distinct stage ids');
  if (channels.size !== 1) throw new Error('compiled repertory must preserve one continuity channel');
  if (hours.some((hour, index) => hour !== index)) throw new Error('compiled repertory hour coverage is incomplete or unordered');

  return Object.freeze(payloads);
}
