import { REPERTORY, productionForHour, validateRepertory } from './hourly-repertory.mjs';

const PUBLIC_PRODUCTION_FIELDS = Object.freeze([
  'id',
  'title',
  'form',
  'continuity_channel',
  'visual_grammar',
  'repertory_index',
  'hour_key',
]);

const REQUIRED_CONTINUITY_VERSION = 1;

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be a plain object.`);
  }
}

export function normalizeContinuityState(input = {}) {
  assertPlainObject(input, 'Continuity state');

  const version = input.version ?? REQUIRED_CONTINUITY_VERSION;
  if (version !== REQUIRED_CONTINUITY_VERSION) {
    throw new RangeError(`Unsupported continuity state version: ${version}.`);
  }

  const revision = Number.isSafeInteger(input.revision) && input.revision >= 0
    ? input.revision
    : 0;

  const marks = Array.isArray(input.marks)
    ? input.marks
        .filter((mark) => typeof mark === 'string')
        .map((mark) => mark.trim())
        .filter(Boolean)
        .slice(-64)
    : [];

  const mode = typeof input.mode === 'string' && input.mode.trim()
    ? input.mode.trim()
    : 'quiet';

  return Object.freeze({
    version,
    revision,
    mode,
    marks: Object.freeze(marks),
  });
}

export function publicProductionProjection(production) {
  assertPlainObject(production, 'Production');

  const projection = {};
  for (const field of PUBLIC_PRODUCTION_FIELDS) {
    if (!(field in production)) {
      throw new TypeError(`Production is missing public field: ${field}.`);
    }
    projection[field] = production[field];
  }

  return Object.freeze(projection);
}

export function createRepertoryRuntimeFrame({
  at = Date.now(),
  continuity = {},
  repertory = REPERTORY,
} = {}) {
  if (!validateRepertory(repertory)) {
    throw new TypeError('Runtime repertory failed validation.');
  }

  const production = productionForHour(at, repertory);
  const continuityState = normalizeContinuityState(continuity);

  return Object.freeze({
    schema_version: 1,
    selection_basis: 'canonical_utc_hour',
    production: publicProductionProjection(production),
    continuity: continuityState,
    runtime_contract: Object.freeze({
      autoplay: false,
      payment_logic: false,
      private_source_material: false,
      reversible_import_boundary: './operations/studio/repertory-runtime-adapter.mjs',
    }),
  });
}

export function nextRepertoryBoundary(input = Date.now()) {
  const date = input instanceof Date ? new Date(input.getTime()) : new Date(input);
  if (Number.isNaN(date.getTime())) throw new TypeError('A valid date or timestamp is required.');
  date.setUTCMinutes(0, 0, 0);
  date.setUTCHours(date.getUTCHours() + 1);
  return date;
}
