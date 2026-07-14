import { selectProductionForDate, selectProductionForHour } from './select-production.mjs';

const FORBIDDEN_PUBLIC_KEYS = Object.freeze([
  'private_source', 'private_sources', 'source_text', 'personal_identifier',
  'payment', 'payments', 'checkout', 'conversion', 'conversion_logic', 'autoplay_url'
]);

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
}

function assertPublicMetadata(metadata) {
  assertPlainObject(metadata, 'public metadata');
  for (const key of FORBIDDEN_PUBLIC_KEYS) {
    if (Object.prototype.hasOwnProperty.call(metadata, key)) throw new Error(`forbidden public metadata key: ${key}`);
  }
}

function freezeObject(value) {
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    Array.isArray(item) ? Object.freeze([...item]) : item,
  ])));
}

export function buildStageDescriptor({ schedule, continuityState, publicMetadata = {}, hour, date } = {}) {
  assertPlainObject(schedule, 'schedule');
  assertPlainObject(continuityState, 'continuityState');
  assertPublicMetadata(publicMetadata);
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
