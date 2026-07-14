import { createRepertoryRuntimeFrame, nextRepertoryBoundary, normalizeContinuityState } from './repertory-runtime-adapter.mjs';
import { createRepertoryTransitionPlan } from './repertory-transition-contract.mjs';

const MAX_TIMER_DELAY_MS = 3_600_000;

function asDate(input, label) {
  const date = input instanceof Date ? new Date(input.getTime()) : new Date(input);
  if (Number.isNaN(date.getTime())) throw new TypeError(`${label} must be a valid date or timestamp.`);
  return date;
}

export function createRepertoryControllerInstruction({
  now = Date.now(),
  continuity = {},
  documentVisible = true,
  prefersReducedMotion = false,
  scheduledActivationAt = null,
} = {}) {
  if (typeof documentVisible !== 'boolean') throw new TypeError('documentVisible must be boolean.');
  if (typeof prefersReducedMotion !== 'boolean') throw new TypeError('prefersReducedMotion must be boolean.');

  const observedAt = asDate(now, 'now');
  const normalizedContinuity = normalizeContinuityState(continuity);
  const currentFrame = createRepertoryRuntimeFrame({ at: observedAt, continuity: normalizedContinuity });
  const scheduledActivation = scheduledActivationAt === null
    ? null
    : asDate(scheduledActivationAt, 'scheduledActivationAt');
  const missedBoundary = scheduledActivation !== null && observedAt.getTime() >= scheduledActivation.getTime();

  if (!documentVisible) {
    return Object.freeze({
      schema_version: 1,
      action: 'suspend_timer',
      observed_at: observedAt.toISOString(),
      production: currentFrame.production,
      continuity: normalizedContinuity,
      timer_delay_ms: null,
      missed_boundary: missedBoundary,
      replay_intermediate_productions: false,
      media: Object.freeze({ autoplay: false, audio_start_requires_user_gesture: true }),
      rollback: Object.freeze({ reversible: true, import_boundary: './operations/studio/repertory-transition-controller.mjs' }),
    });
  }

  if (missedBoundary) {
    const nextBoundary = nextRepertoryBoundary(observedAt);
    return Object.freeze({
      schema_version: 1,
      action: 'resync_now',
      observed_at: observedAt.toISOString(),
      production: currentFrame.production,
      continuity: normalizedContinuity,
      timer_delay_ms: Math.min(nextBoundary.getTime() - observedAt.getTime(), MAX_TIMER_DELAY_MS),
      missed_boundary: true,
      replay_intermediate_productions: false,
      accessibility: Object.freeze({ preserve_focus: true, aria_live: 'polite', announce_title: true }),
      media: Object.freeze({ autoplay: false, audio_start_requires_user_gesture: true }),
      rollback: Object.freeze({ reversible: true, import_boundary: './operations/studio/repertory-transition-controller.mjs' }),
    });
  }

  const plan = createRepertoryTransitionPlan({
    at: observedAt,
    continuity: normalizedContinuity,
    documentVisible: true,
    prefersReducedMotion,
  });
  const delay = asDate(plan.activation_at, 'activation_at').getTime() - observedAt.getTime();

  return Object.freeze({
    schema_version: 1,
    action: 'schedule_transition',
    observed_at: observedAt.toISOString(),
    production: currentFrame.production,
    continuity: normalizedContinuity,
    transition: plan,
    timer_delay_ms: Math.min(Math.max(delay, 0), MAX_TIMER_DELAY_MS),
    missed_boundary: false,
    replay_intermediate_productions: false,
    media: Object.freeze({ autoplay: false, audio_start_requires_user_gesture: true }),
    rollback: Object.freeze({ reversible: true, import_boundary: './operations/studio/repertory-transition-controller.mjs' }),
  });
}
