import { selectProductionForDate, selectProductionForHour } from './select-production.mjs';

const FORBIDDEN_PUBLIC_KEYS = Object.freeze([
  'private_source', 'private_sources', 'source_text', 'personal_identifier',
  'payment', 'payments', 'checkout', 'conversion', 'conversion_logic', 'autoplay_url'
]);

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
}

function assertPublicValue(value, path = 'public metadata') {
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return;

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      assertPublicValue(value[index], `${path}[${index}]`);
    }
    return;
  }

  assertPlainObject(value, path);
  for (const [key, item] of Object.entries(value)) {
    if (FORBIDDEN_PUBLIC_KEYS.includes(key)) {
      throw new Error(`forbidden public metadata key at ${path}.${key}: ${key}`);
    }
    assertPublicValue(item, `${path}.${key}`);
  }
}

function freezeObject(value) {
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    Array.isArray(item)
      ? Object.freeze(item.map((entry) => entry && typeof entry === 'object' ? freezeObject(entry) : entry))
      : item && typeof item === 'object'
        ? freezeObject(item)
        : item,
  ])));
}

export function buildStageDescriptor({ schedule, continuityState, publicMetadata = {}, hour, date } = {}) {
  assertPlainObject(schedule, 'schedule');
  assertPlainObject(continuityState, 'continuityState');
  assertPlainObject(publicMetadata, 'public metadata');
  assertPublicValue(publicMetadata);
  if ((hour === undefined) === (date === undefined)) throw new Error('provide exactly one of hour or date');

  const production = hour === undefined
    ? selectProductionForDate(schedule, date)
    : selectProductionForHour(schedule, hour);

  if (continuityState.channel !== schedule.continuity?.state_channel) {
    throw new Error('continuityState channel must match the repertory state channel');
  }

  const descriptor = {
    schema_version: 1,
    activation: 'operations-only-default-off',
    public_surface: true,
    production: freezeObject(production),
    continuity: Object.freeze({ channel: continuityState.channel, revision: continuityState.revision ?? null }),
    controls: Object.freeze({ autoplay: false, payments: false, conversion_logic: false }),
    public_metadata: freezeObject(publicMetadata),
  };

  return Object.freeze(descriptor);
}
