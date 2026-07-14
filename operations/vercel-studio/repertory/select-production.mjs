const REQUIRED_ACCESSIBILITY = Object.freeze([
  'keyboard-complete',
  'screen-reader-labelled',
  'reduced-motion-safe',
]);

function assertIntegerHour(hour) {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error('hour must be an integer from 0 through 23');
  }
}

function assertAccessibility(production) {
  if (!Array.isArray(production.accessibility)) {
    throw new Error(`accessibility guarantees missing for ${production.id}`);
  }
  const guarantees = new Set(production.accessibility);
  for (const requirement of REQUIRED_ACCESSIBILITY) {
    if (!guarantees.has(requirement)) {
      throw new Error(`accessibility requirement ${requirement} missing for ${production.id}`);
    }
  }
}

function assertSchedule(schedule) {
  if (!schedule || schedule.schema_version !== 1) {
    throw new Error('schedule schema_version must equal 1');
  }
  if (schedule.selection?.strategy !== 'local-hour-modulo') {
    throw new Error('schedule selection strategy must equal local-hour-modulo');
  }
  if (schedule.selection?.randomness !== false) {
    throw new Error('schedule randomness must remain disabled');
  }
  if (typeof schedule.selection?.fallback !== 'string' || schedule.selection.fallback.trim() === '') {
    throw new Error('schedule fallback must be a non-empty production id');
  }
  if (!Array.isArray(schedule.productions) || schedule.productions.length !== 24) {
    throw new Error('schedule must contain exactly 24 productions');
  }

  const hours = new Set();
  const ids = new Set();
  for (const production of schedule.productions) {
    assertIntegerHour(production.hour);
    if (hours.has(production.hour)) throw new Error(`duplicate production hour: ${production.hour}`);
    if (typeof production.id !== 'string' || production.id.trim() === '') throw new Error('production id must be non-empty');
    if (ids.has(production.id)) throw new Error(`duplicate production id: ${production.id}`);
    if (production.autoplay !== false) throw new Error(`autoplay must remain disabled for ${production.id}`);
    if (production.continuity_channel !== schedule.continuity?.state_channel) {
      throw new Error(`continuity channel mismatch for ${production.id}`);
    }
    assertAccessibility(production);
    hours.add(production.hour);
    ids.add(production.id);
  }

  for (let hour = 0; hour < 24; hour += 1) {
    if (!hours.has(hour)) throw new Error(`missing production hour: ${hour}`);
  }
  if (!ids.has(schedule.selection.fallback)) {
    throw new Error(`schedule fallback does not resolve: ${schedule.selection.fallback}`);
  }
}

export function selectProductionForHour(schedule, hour) {
  assertSchedule(schedule);
  assertIntegerHour(hour);
  const production = schedule.productions.find((candidate) => candidate.hour === hour);
  if (!production) throw new Error(`no production found for hour ${hour}`);
  return Object.freeze({ ...production, accessibility: Object.freeze([...production.accessibility]) });
}

export function selectProductionForDate(schedule, date, timeZone = schedule?.selection?.timezone) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new Error('date must be valid');
  if (typeof timeZone !== 'string' || timeZone.trim() === '') throw new Error('timeZone must be non-empty');

  let hour;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    hour = Number(parts.find((part) => part.type === 'hour')?.value);
  } catch (error) {
    throw new Error(`invalid timeZone: ${timeZone}`, { cause: error });
  }

  return selectProductionForHour(schedule, hour);
}
