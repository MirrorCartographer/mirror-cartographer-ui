const REQUIRED_SAFETY = Object.freeze([
  'mobile_safe',
  'accessible',
  'reversible',
]);

function assertObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be a plain object`);
  }
}

export function validatePublicStagePayload(payload) {
  assertObject(payload, 'payload');
  assertObject(payload.stage, 'payload.stage');
  assertObject(payload.controls, 'payload.controls');
  assertObject(payload.continuity, 'payload.continuity');
  assertObject(payload.safety, 'payload.safety');

  if (!Number.isInteger(payload.resolved_hour) || payload.resolved_hour < 0 || payload.resolved_hour > 23) {
    throw new Error('payload.resolved_hour must be an integer from 0 through 23');
  }
  for (const field of ['id', 'title', 'form', 'motion', 'sound']) {
    if (typeof payload.stage[field] !== 'string' || !payload.stage[field].trim()) {
      throw new Error(`payload.stage.${field} must be a non-empty string`);
    }
  }
  if (payload.controls.autoplay !== false) throw new Error('autoplay must remain disabled');
  if (payload.controls.sound_requires_user_action !== true) throw new Error('sound must require user action');
  if (payload.controls.reduced_motion_supported !== true) throw new Error('reduced motion must be supported');
  for (const flag of REQUIRED_SAFETY) {
    if (payload.safety[flag] !== true) throw new Error(`payload.safety.${flag} must be true`);
  }
  if (payload.safety.contains_payment_or_conversion_logic !== false) throw new Error('payment or conversion logic is prohibited');
  if (payload.safety.contains_private_source_material !== false) throw new Error('private source material is prohibited');
  if (typeof payload.continuity.channel !== 'string' || !payload.continuity.channel.trim()) {
    throw new Error('payload.continuity.channel must be a non-empty string');
  }
  return Object.freeze(payload);
}

export function selectHourlyStage(publicPayloads, date = new Date()) {
  if (!Array.isArray(publicPayloads) || publicPayloads.length !== 24) {
    throw new Error('publicPayloads must contain exactly 24 entries');
  }
  const hour = date.getHours();
  const payload = validatePublicStagePayload(publicPayloads[hour]);
  if (payload.resolved_hour !== hour) throw new Error('selected payload does not match the resolved local hour');
  return payload;
}

export function installHourlyStageRuntime({
  enabled = false,
  publicPayloads,
  window,
  document,
  now = () => new Date(),
} = {}) {
  if (enabled !== true) return Object.freeze({ installed: false, reason: 'feature_disabled' });
  if (!window || !document?.documentElement) throw new Error('window and document are required');

  const payload = selectHourlyStage(publicPayloads, now());
  const root = document.documentElement;
  root.dataset.mcStageId = payload.stage.id;
  root.dataset.mcStageHour = String(payload.resolved_hour);
  root.dataset.mcContinuityChannel = payload.continuity.channel;
  root.dataset.mcReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'reduce' : 'no-preference';

  window.dispatchEvent(new window.CustomEvent('mirrorcartographer:hourly-stage', {
    detail: payload,
  }));

  return Object.freeze({
    installed: true,
    stage_id: payload.stage.id,
    resolved_hour: payload.resolved_hour,
    rollback() {
      delete root.dataset.mcStageId;
      delete root.dataset.mcStageHour;
      delete root.dataset.mcContinuityChannel;
      delete root.dataset.mcReducedMotion;
    },
  });
}
