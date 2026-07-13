const HOURS_PER_DAY = 24;

export function validateRepertory(schedule) {
  if (!schedule || schedule.schema_version !== 1) throw new Error('schema_version must equal 1');
  if (schedule.selection?.timezone !== 'America/New_York') throw new Error('selection timezone must be America/New_York');
  if (schedule.selection?.strategy !== 'local-hour-modulo') throw new Error('selection strategy must be local-hour-modulo');
  if (!Array.isArray(schedule.productions) || schedule.productions.length !== HOURS_PER_DAY) {
    throw new Error('repertory must contain exactly 24 productions');
  }
  const hours = new Set();
  const ids = new Set();
  for (const production of schedule.productions) {
    if (!Number.isInteger(production.hour) || production.hour < 0 || production.hour >= HOURS_PER_DAY) {
      throw new Error(`invalid production hour: ${production.hour}`);
    }
    if (hours.has(production.hour)) throw new Error(`duplicate production hour: ${production.hour}`);
    if (!production.id || ids.has(production.id)) throw new Error(`duplicate or missing production id: ${production.id}`);
    if (production.autoplay !== false) throw new Error(`${production.id} must disable autoplay`);
    if (production.continuity_channel !== 'shared-runtime-state') throw new Error(`${production.id} must preserve shared-runtime-state`);
    if (!Array.isArray(production.accessibility) || !production.accessibility.includes('reduced-motion-safe')) {
      throw new Error(`${production.id} must declare reduced-motion-safe`);
    }
    hours.add(production.hour);
    ids.add(production.id);
  }
  for (let hour = 0; hour < HOURS_PER_DAY; hour += 1) {
    if (!hours.has(hour)) throw new Error(`missing production hour: ${hour}`);
  }
  return true;
}

export function selectProduction(schedule, localHour) {
  validateRepertory(schedule);
  if (!Number.isInteger(localHour)) throw new Error('localHour must be an integer');
  const normalizedHour = ((localHour % HOURS_PER_DAY) + HOURS_PER_DAY) % HOURS_PER_DAY;
  return schedule.productions.find((production) => production.hour === normalizedHour);
}
