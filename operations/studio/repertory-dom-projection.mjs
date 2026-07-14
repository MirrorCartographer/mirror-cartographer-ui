const ALLOWED_ACTIONS = new Set(['schedule_transition', 'resync_now', 'suspend_timer']);
const ALLOWED_FORMS = new Set(['instrument', 'film', 'stage', 'interface']);

function plainObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be a plain object.`);
  }
  return value;
}

function text(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} must be a non-empty string.`);
  return value.trim();
}

/**
 * Converts a repertory controller instruction into a public, DOM-ready view model.
 * The projection deliberately excludes provenance, private source material, payment
 * fields, raw continuity marks, and autoplay instructions.
 */
export function createRepertoryDomProjection(instruction) {
  plainObject(instruction, 'Instruction');
  if (!ALLOWED_ACTIONS.has(instruction.action)) throw new RangeError(`Unsupported instruction action: ${instruction.action}.`);

  const production = plainObject(instruction.production, 'Production');
  const form = text(production.form, 'Production form');
  if (!ALLOWED_FORMS.has(form)) throw new RangeError(`Unsupported production form: ${form}.`);

  const continuity = plainObject(instruction.continuity, 'Continuity');
  if (continuity.version !== 1) throw new RangeError('Only shared continuity version 1 is public-mountable.');

  const title = text(production.title, 'Production title');
  const id = text(production.id, 'Production id');
  const visualGrammar = text(production.visual_grammar, 'Visual grammar');
  const suspended = instruction.action === 'suspend_timer';
  const announce = instruction.action === 'resync_now' || instruction.accessibility?.announce_title === true;

  return Object.freeze({
    schema_version: 1,
    mount_key: `${production.hour_key}:${id}`,
    production: Object.freeze({ id, title, form, visual_grammar: visualGrammar }),
    continuity: Object.freeze({
      channel: text(production.continuity_channel, 'Continuity channel'),
      version: 1,
      revision: Number.isSafeInteger(continuity.revision) && continuity.revision >= 0 ? continuity.revision : 0,
      mode: typeof continuity.mode === 'string' && continuity.mode.trim() ? continuity.mode.trim() : 'quiet',
    }),
    lifecycle: Object.freeze({
      action: instruction.action,
      suspended,
      missed_boundary: instruction.missed_boundary === true,
      replay_intermediate_productions: false,
    }),
    accessibility: Object.freeze({
      landmark_role: 'region',
      label: `${title} — ${form}`,
      aria_live: announce ? 'polite' : 'off',
      preserve_focus: true,
      reduced_motion_safe: true,
    }),
    media: Object.freeze({ autoplay: false, audio_start_requires_user_gesture: true }),
    privacy: Object.freeze({ private_source_material: false, raw_continuity_marks_exposed: false }),
    commerce: Object.freeze({ payment_logic: false, conversion_logic: false }),
    rollback: Object.freeze({
      reversible: true,
      import_boundary: './operations/studio/repertory-dom-projection.mjs',
    }),
  });
}
