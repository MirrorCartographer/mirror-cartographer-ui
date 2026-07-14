const ALLOWED_PROVENANCE = Object.freeze(['observed', 'inferred', 'experiment', 'current_decision']);
const FORBIDDEN_TEXT = /(?:credential|secret|token|email|payment|conversion|diagnos|health|private_source)/i;

function assertObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be a plain object`);
  }
}

function assertPublicString(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a non-empty string`);
  if (FORBIDDEN_TEXT.test(value)) throw new Error(`${name} contains prohibited language`);
  return value.trim();
}

function copyProvenance(provenance) {
  assertObject(provenance, 'manifest.provenance');
  const output = {};
  for (const category of ALLOWED_PROVENANCE) {
    const value = provenance[category];
    if (category === 'current_decision') {
      output[category] = assertPublicString(value, `manifest.provenance.${category}`);
      continue;
    }
    if (!Array.isArray(value) || value.length === 0) throw new Error(`manifest.provenance.${category} must be a non-empty array`);
    output[category] = value.map((entry, index) => assertPublicString(entry, `manifest.provenance.${category}[${index}]`));
  }
  return Object.freeze(output);
}

export function createPublicHourlyStagePayload(manifest) {
  assertObject(manifest, 'manifest');
  assertObject(manifest.production, 'manifest.production');
  assertObject(manifest.continuity, 'manifest.continuity');

  if (manifest.production.autoplay !== false) throw new Error('public stage must remain non-autoplaying');
  for (const flag of ['mobile_safe', 'accessible', 'reversible']) {
    if (manifest.production[flag] !== true) throw new Error(`public stage requires ${flag}=true`);
  }

  const payload = {
    schema_version: 1,
    resolved_hour: manifest.resolved_hour,
    time_zone: assertPublicString(manifest.time_zone, 'manifest.time_zone'),
    stage: {
      id: assertPublicString(manifest.production.id, 'manifest.production.id'),
      title: assertPublicString(manifest.production.title, 'manifest.production.title'),
      form: assertPublicString(manifest.production.form, 'manifest.production.form'),
      motion: assertPublicString(manifest.production.motion, 'manifest.production.motion'),
      sound: assertPublicString(manifest.production.sound, 'manifest.production.sound')
    },
    controls: {
      autoplay: false,
      sound_requires_user_action: true,
      reduced_motion_supported: true
    },
    continuity: {
      channel: assertPublicString(manifest.continuity.channel, 'manifest.continuity.channel')
    },
    provenance: copyProvenance(manifest.provenance),
    safety: {
      mobile_safe: true,
      accessible: true,
      reversible: true,
      contains_payment_or_conversion_logic: false,
      contains_private_source_material: false
    }
  };

  if (!Number.isInteger(payload.resolved_hour) || payload.resolved_hour < 0 || payload.resolved_hour > 23) {
    throw new Error('manifest.resolved_hour must be an integer from 0 through 23');
  }

  return Object.freeze(payload);
}

export function serializePublicHourlyStagePayload(manifest) {
  return `${JSON.stringify(createPublicHourlyStagePayload(manifest))}\n`;
}
