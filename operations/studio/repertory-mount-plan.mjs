const SAFE_TAGS = new Set(['section', 'article', 'main']);

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be a plain object.`);
  }
  return value;
}

function requireText(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

/**
 * Produces a deterministic, declarative mount plan from the public repertory
 * projection. The plan contains no executable HTML, private marks, autoplay,
 * commerce, network, persistence, or focus-stealing instructions.
 */
export function createRepertoryMountPlan(projection, options = {}) {
  requireObject(projection, 'Projection');
  requireObject(projection.production, 'Projection production');
  requireObject(projection.continuity, 'Projection continuity');
  requireObject(projection.lifecycle, 'Projection lifecycle');
  requireObject(projection.accessibility, 'Projection accessibility');
  requireObject(projection.media, 'Projection media');
  requireObject(projection.privacy, 'Projection privacy');
  requireObject(projection.commerce, 'Projection commerce');

  if (projection.schema_version !== 1) throw new RangeError('Unsupported projection schema version.');
  if (projection.continuity.version !== 1) throw new RangeError('Unsupported continuity version.');
  if (projection.media.autoplay !== false || projection.media.audio_start_requires_user_gesture !== true) {
    throw new RangeError('Unsafe media policy.');
  }
  if (projection.privacy.private_source_material !== false || projection.privacy.raw_continuity_marks_exposed !== false) {
    throw new RangeError('Unsafe privacy policy.');
  }
  if (projection.commerce.payment_logic !== false || projection.commerce.conversion_logic !== false) {
    throw new RangeError('Commerce logic is not mountable.');
  }

  const tag = options.tag ?? 'section';
  if (!SAFE_TAGS.has(tag)) throw new RangeError(`Unsupported mount tag: ${tag}.`);

  const title = requireText(projection.production.title, 'Production title');
  const id = requireText(projection.production.id, 'Production id');
  const form = requireText(projection.production.form, 'Production form');
  const grammar = requireText(projection.production.visual_grammar, 'Visual grammar');
  const mountKey = requireText(projection.mount_key, 'Mount key');
  const channel = requireText(projection.continuity.channel, 'Continuity channel');

  return Object.freeze({
    schema_version: 1,
    operation: projection.lifecycle.suspended ? 'suspend' : 'replace',
    target: Object.freeze({ selector: options.selector ?? '[data-mirror-repertory-root]', tag }),
    identity: Object.freeze({ mount_key: mountKey, production_id: id }),
    attributes: Object.freeze({
      'data-production-id': id,
      'data-production-form': form,
      'data-continuity-channel': channel,
      'data-continuity-revision': String(projection.continuity.revision),
      role: projection.accessibility.landmark_role,
      'aria-label': projection.accessibility.label,
      'aria-live': projection.accessibility.aria_live,
      inert: projection.lifecycle.suspended,
    }),
    content: Object.freeze({
      heading: title,
      visual_grammar: grammar,
      status: projection.lifecycle.suspended ? 'Production suspended while hidden.' : `${title} is on stage.`,
    }),
    behavior: Object.freeze({
      preserve_focus: true,
      focus_target: null,
      autoplay: false,
      audio_start_requires_user_gesture: true,
      replay_intermediate_productions: false,
      network_requests: false,
      persistence: false,
      safe_area_insets: true,
      reduced_motion_safe: true,
    }),
    rollback: Object.freeze({ reversible: true, remove_selector: options.selector ?? '[data-mirror-repertory-root]' }),
  });
}
