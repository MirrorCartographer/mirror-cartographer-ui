import {
  createRepertoryRuntimeFrame,
  nextRepertoryBoundary,
  normalizeContinuityState,
} from './repertory-runtime-adapter.mjs';

const MAX_TRANSITION_MS = 300;

function validDate(input) {
  const date = input instanceof Date ? new Date(input.getTime()) : new Date(input);
  if (Number.isNaN(date.getTime())) throw new TypeError('A valid date or timestamp is required.');
  return date;
}

export function createRepertoryTransitionPlan({
  at = Date.now(),
  continuity = {},
  prefersReducedMotion = false,
  documentVisible = true,
} = {}) {
  if (typeof prefersReducedMotion !== 'boolean') {
    throw new TypeError('prefersReducedMotion must be boolean.');
  }
  if (typeof documentVisible !== 'boolean') {
    throw new TypeError('documentVisible must be boolean.');
  }

  const now = validDate(at);
  const activation = nextRepertoryBoundary(now);
  const normalizedContinuity = normalizeContinuityState(continuity);
  const current = createRepertoryRuntimeFrame({ at: now, continuity: normalizedContinuity });
  const next = createRepertoryRuntimeFrame({ at: activation, continuity: normalizedContinuity });

  if (current.production.id === next.production.id) {
    throw new Error('Repertory boundary must advance to a distinct production.');
  }

  const motion = prefersReducedMotion
    ? Object.freeze({ strategy: 'instant', duration_ms: 0 })
    : Object.freeze({ strategy: 'crossfade', duration_ms: 240 });

  if (motion.duration_ms > MAX_TRANSITION_MS) {
    throw new RangeError('Transition exceeds the mobile-safe duration ceiling.');
  }

  return Object.freeze({
    schema_version: 1,
    current: current.production,
    next: next.production,
    continuity: normalizedContinuity,
    activation_at: activation.toISOString(),
    scheduling: Object.freeze({
      clock: 'canonical_utc_hour',
      hidden_document_behavior: documentVisible ? 'schedule_boundary' : 'resync_on_visibility',
      missed_boundary_behavior: 'select_current_hour_without_replaying_intermediate_productions',
    }),
    motion,
    accessibility: Object.freeze({
      preserve_focus: true,
      announce_title: true,
      aria_live: 'polite',
      reduced_motion_respected: true,
    }),
    media: Object.freeze({ autoplay: false, audio_start_requires_user_gesture: true }),
    privacy: Object.freeze({ private_source_material: false }),
    commerce: Object.freeze({ payment_logic: false }),
    rollback: Object.freeze({
      reversible: true,
      import_boundary: './operations/studio/repertory-transition-contract.mjs',
    }),
  });
}
