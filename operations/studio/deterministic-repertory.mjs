import crypto from 'node:crypto';

export const DEFAULT_REPERTORY = Object.freeze([
  Object.freeze({ id: 'operating-atlas', title: 'Operating Atlas', surface: 'atlas', motion: 'bounded', audio: 'off', rollback: 'atlas' }),
  Object.freeze({ id: 'constellation-archive', title: 'Constellation Archive', surface: 'archive', motion: 'reduced-safe', audio: 'off', rollback: 'atlas' }),
  Object.freeze({ id: 'body-signal-map', title: 'Body Signal Map', surface: 'body', motion: 'none', audio: 'off', rollback: 'atlas' }),
  Object.freeze({ id: 'evidence-room', title: 'Evidence Room', surface: 'proof', motion: 'none', audio: 'off', rollback: 'atlas' }),
  Object.freeze({ id: 'symbol-foundry', title: 'Symbol Foundry', surface: 'symbols', motion: 'bounded', audio: 'off', rollback: 'atlas' }),
  Object.freeze({ id: 'creative-sky', title: 'Creative Sky', surface: 'creative', motion: 'opt-in', audio: 'opt-in', rollback: 'atlas' }),
]);

function assertHour(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError('A valid instant is required.');
  return date;
}

export function hourKey(value) {
  return assertHour(value).toISOString().slice(0, 13);
}

export function selectProduction(value, repertory = DEFAULT_REPERTORY) {
  if (!Array.isArray(repertory) || repertory.length < 2) throw new TypeError('Repertory requires at least two productions.');
  const ids = repertory.map((item) => item?.id);
  if (ids.some((id) => typeof id !== 'string' || !id.trim())) throw new TypeError('Every production requires a stable id.');
  if (new Set(ids).size !== ids.length) throw new TypeError('Production ids must be unique.');
  const key = hourKey(value);
  const digest = crypto.createHash('sha256').update(`mirror-cartographer-repertory-v1:${key}`).digest();
  const index = digest.readUInt32BE(0) % repertory.length;
  return Object.freeze({ ...repertory[index], hour_key: key, repertory_index: index, selection_algorithm: 'sha256-hour-v1' });
}

export function verifyProductionContract(production) {
  const failures = [];
  if (production.audio === 'autoplay') failures.push('audio_autoplay_forbidden');
  if (!['none', 'bounded', 'reduced-safe', 'opt-in'].includes(production.motion)) failures.push('motion_policy_invalid');
  if (!production.rollback) failures.push('rollback_missing');
  if (!production.surface) failures.push('surface_missing');
  return Object.freeze({ verified: failures.length === 0, failures });
}
