const REQUIRED_SLOTS = 24;

function assertInteger(value, name) {
  if (!Number.isInteger(value)) throw new TypeError(`${name} must be an integer`);
}

export function validateRepertory(repertory) {
  if (!Array.isArray(repertory) || repertory.length !== REQUIRED_SLOTS) {
    throw new Error(`repertory must contain exactly ${REQUIRED_SLOTS} slots`);
  }

  const ids = new Set();
  const hours = new Set();
  let continuityChannel = null;

  for (const slot of repertory) {
    if (!slot || typeof slot !== 'object' || Array.isArray(slot)) throw new Error('every slot must be an object');
    assertInteger(slot.hour, 'slot.hour');
    if (slot.hour < 0 || slot.hour > 23 || hours.has(slot.hour)) throw new Error('slot hours must be unique integers from 0 through 23');
    hours.add(slot.hour);

    if (typeof slot.id !== 'string' || !slot.id.trim() || ids.has(slot.id)) throw new Error('slot ids must be unique non-empty strings');
    ids.add(slot.id);

    if (slot.autoplay !== false) throw new Error(`${slot.id} must explicitly disable autoplay`);
    if (slot.payment_or_conversion_logic !== false) throw new Error(`${slot.id} must explicitly exclude payment and conversion logic`);
    if (slot.mobile_safe !== true || slot.accessible !== true || slot.reversible !== true) {
      throw new Error(`${slot.id} must be mobile-safe, accessible, and reversible`);
    }
    if (typeof slot.continuity_channel !== 'string' || !slot.continuity_channel.trim()) throw new Error(`${slot.id} requires a continuity channel`);
    continuityChannel ??= slot.continuity_channel;
    if (slot.continuity_channel !== continuityChannel) throw new Error('all productions must preserve one continuity channel');
  }

  for (let hour = 0; hour < REQUIRED_SLOTS; hour += 1) {
    if (!hours.has(hour)) throw new Error(`missing repertory hour ${hour}`);
  }

  return Object.freeze({ slot_count: REQUIRED_SLOTS, continuity_channel: continuityChannel });
}

export function selectHourlyProduction({ repertory, instant, timeZone = 'UTC' }) {
  validateRepertory(repertory);
  const date = instant instanceof Date ? instant : new Date(instant);
  if (Number.isNaN(date.getTime())) throw new TypeError('instant must resolve to a valid date');

  const hourPart = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date).find((part) => part.type === 'hour');

  const hour = Number(hourPart?.value);
  assertInteger(hour, 'resolved hour');
  const production = repertory.find((slot) => slot.hour === hour);
  if (!production) throw new Error(`no production configured for resolved hour ${hour}`);

  return Object.freeze({
    selector: `hour-${String(hour).padStart(2, '0')}`,
    resolved_hour: hour,
    time_zone: timeZone,
    instant: date.toISOString(),
    production: Object.freeze({ ...production })
  });
}
