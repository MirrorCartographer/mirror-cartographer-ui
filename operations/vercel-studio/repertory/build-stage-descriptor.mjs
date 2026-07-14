import { selectProductionForDate, selectProductionForHour } from './select-production.mjs';

const FORBIDDEN_PUBLIC_KEYS = Object.freeze([
  'private_source', 'private_sources', 'source_text', 'personal_identifier',
  'payment', 'payments', 'checkout', 'conversion', 'conversion_logic', 'autoplay_url'
]);

const MAX_PUBLIC_STRING_LENGTH = 280;
const FORBIDDEN_PUBLIC_STRING_PATTERNS = Object.freeze([
  Object.freeze({ id: 'email-address', pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i }),
  Object.freeze({ id: 'credential-assignment', pattern: /\b(?:api[_-]?key|access[_-]?token|secret|password)\s*[:=]/i }),
  Object.freeze({ id: 'bearer-token', pattern: /\bbearer\s+[A-Z0-9._~+\/-]{12,}/i }),
  Object.freeze({ id: 'private-source-marker', pattern: /\b(?:private source|private chat|medical record|health record)\b/i }),
  Object.freeze({ id: 'commerce-route', pattern: /(?:https?:\/\/[^\s]+)?\/(?:checkout|pay|payment|subscribe)(?:[/?#]|\b)/i }),
]);

function assertPlainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
}

function assertPublicString(value, path) {
  if (value.length > MAX_PUBLIC_STRING_LENGTH) {
    throw new Error(`public metadata string exceeds ${MAX_PUBLIC_STRING_LENGTH} characters at ${path}`);
  }
  if (/[^\P{Cc}\t\n\r]/u.test(value)) {
    throw new Error(`public metadata string contains disallowed control characters at ${path}`);
  }
  for (const rule of FORBIDDEN_PUBLIC_STRING_PATTERNS) {
    if (rule.pattern.test(value)) {
      throw new Error(`forbidden public metadata string pattern ${rule.id} at ${path}`);
    }
  }
}

function assertPublicValue(value, path = 'public metadata') {
  if (typeof value === 'string') {
    assertPublicString(value, path);
    return;
  }
  if (value === null || ['number', 'boolean'].includes(typeof value)) return;

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
