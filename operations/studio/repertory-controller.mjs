import { createRepertoryStageReceipt } from './repertory-stage-receipt.mjs';

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be a plain object.`);
  return value;
}
function requireText(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} must be a non-empty string.`);
  return value.trim();
}
function freezeProduction(entry) {
  requireObject(entry, 'Production');
  return Object.freeze({
    id: requireText(entry.id, 'Production id'),
    title: requireText(entry.title, 'Production title'),
    renderer: requireText(entry.renderer, 'Production renderer'),
    audio_policy: entry.audio_policy === 'user_initiated' ? 'user_initiated' : 'silent',
    motion_policy: entry.motion_policy === 'essential' ? 'essential' : 'reducible',
  });
}

/** Deterministic hour-to-production mapping with no randomness or private source data. */
export function createRepertorySchedule(productions) {
  if (!Array.isArray(productions) || productions.length < 2) throw new TypeError('Repertory requires at least two productions.');
  const frozen = productions.map(freezeProduction);
  if (new Set(frozen.map(({ id }) => id)).size !== frozen.length) throw new Error('Production ids must be unique.');
  return Object.freeze({
    select(hour) {
      if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new RangeError('Hour must be an integer from 0 through 23.');
      const production = frozen[hour % frozen.length];
      return Object.freeze({ slot_key: `hour-${String(hour).padStart(2, '0')}`, hour, production_id: production.id, deterministic: true, production });
    },
  });
}

/**
 * Runs one complete reversible stage transaction. The injected stage adapter is
 * the only DOM-facing boundary, keeping selection and policy testable in Node.
 */
export function createRepertoryController({ productions, stage, continuity }) {
  const schedule = createRepertorySchedule(productions);
  if (typeof stage !== 'function') throw new TypeError('Stage adapter must be a function.');
  requireObject(continuity, 'Continuity state');
  const continuityId = requireText(continuity.id, 'Continuity id');
  const continuityRevision = requireText(continuity.revision, 'Continuity revision');

  return Object.freeze({
    async present({ hour, observed_at: observedAt, reduced_motion: reducedMotion = false }) {
      const scheduled = schedule.select(hour);
      const production = scheduled.production;
      const mountKey = `${production.id}@${scheduled.slot_key}`;
      const projection = Object.freeze({
        production,
        mount_key: mountKey,
        continuity: Object.freeze({ id: continuityId, revision: continuityRevision }),
        policy: Object.freeze({
          autoplay: false,
          reduced_motion: reducedMotion === true,
          motion_enabled: production.motion_policy === 'essential' ? true : reducedMotion !== true,
          audio_enabled: false,
          audio_activation: production.audio_policy,
        }),
      });
      const stageResult = await stage(projection);
      requireObject(stageResult, 'Stage result');
      if (stageResult.continuity_id !== continuityId || stageResult.continuity_revision !== continuityRevision) {
        throw new Error('Stage transaction did not preserve the underlying continuity state.');
      }
      const receipt = createRepertoryStageReceipt({ scheduled, projection, stage_result: stageResult, observed_at: observedAt });
      return Object.freeze({ scheduled, projection, receipt });
    },
  });
}
