'use strict';

const { selectHourlyProduction, validateRepertory } = require('./selectHourlyProduction.v1.cjs');

const FORBIDDEN_STATE_KEYS = new Set([
  'email',
  'phone',
  'address',
  'credential',
  'credentials',
  'password',
  'secret',
  'token',
  'access_token',
  'refresh_token',
  'private_source',
  'private_source_material',
  'payment',
  'checkout',
]);

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be a plain object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError(`${label} must be a plain object`);
  }
}

function validatePublicContinuityState(state, path = 'continuity_state') {
  assertPlainObject(state, path);

  for (const [key, value] of Object.entries(state)) {
    const normalizedKey = key.trim().toLowerCase();
    if (!normalizedKey || FORBIDDEN_STATE_KEYS.has(normalizedKey)) {
      throw new Error(`${path}.${key || '<empty>'} is not permitted in public continuity state`);
    }

    if (value === undefined || typeof value === 'function' || typeof value === 'symbol') {
      throw new TypeError(`${path}.${key} must be JSON-safe`);
    }

    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new TypeError(`${path}.${key} must be finite`);
    }

    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        const item = value[index];
        if (item && typeof item === 'object') {
          validatePublicContinuityState(item, `${path}.${key}[${index}]`);
        } else if (
          item === undefined ||
          typeof item === 'function' ||
          typeof item === 'symbol' ||
          (typeof item === 'number' && !Number.isFinite(item))
        ) {
          throw new TypeError(`${path}.${key}[${index}] must be JSON-safe`);
        }
      }
    } else if (value && typeof value === 'object') {
      validatePublicContinuityState(value, `${path}.${key}`);
    }
  }

  return true;
}

function deepCloneAndFreeze(value) {
  if (Array.isArray(value)) {
    return Object.freeze(value.map(deepCloneAndFreeze));
  }
  if (value && typeof value === 'object') {
    const clone = {};
    for (const [key, child] of Object.entries(value)) {
      clone[key] = deepCloneAndFreeze(child);
    }
    return Object.freeze(clone);
  }
  return value;
}

function transitionHourlyProduction(repertory, continuityState, fromUtcHour, toUtcHour) {
  validateRepertory(repertory);
  validatePublicContinuityState(continuityState);

  const from = selectHourlyProduction(repertory, fromUtcHour);
  const to = selectHourlyProduction(repertory, toUtcHour);
  const preservedState = deepCloneAndFreeze(continuityState);

  return Object.freeze({
    contract_id: 'vercel-studio-hourly-transition-v1',
    from,
    to,
    production_changed: from.production_id !== to.production_id,
    continuity_state: preservedState,
    continuity_state_preserved: true,
    side_effects_performed: false,
  });
}

module.exports = {
  transitionHourlyProduction,
  validatePublicContinuityState,
};
