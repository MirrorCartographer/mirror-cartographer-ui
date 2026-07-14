import { createRepertoryControllerInstruction } from './repertory-transition-controller.mjs';

function requireFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}

function isDocumentVisible(documentRef) {
  return documentRef.visibilityState !== 'hidden';
}

function reducedMotionPreference(matchMediaRef) {
  if (typeof matchMediaRef !== 'function') return false;
  return Boolean(matchMediaRef('(prefers-reduced-motion: reduce)').matches);
}

/**
 * Connects the pure repertory controller to browser lifecycle primitives.
 * All side effects are injected so the boundary remains deterministic,
 * testable, non-autoplaying, and removable by deleting one import/call site.
 */
export function createRepertoryBrowserAdapter({
  documentRef = globalThis.document,
  matchMediaRef = globalThis.matchMedia?.bind(globalThis),
  now = Date.now,
  setTimeoutRef = globalThis.setTimeout?.bind(globalThis),
  clearTimeoutRef = globalThis.clearTimeout?.bind(globalThis),
  continuity = {},
  onInstruction,
} = {}) {
  if (!documentRef || typeof documentRef.addEventListener !== 'function' || typeof documentRef.removeEventListener !== 'function') {
    throw new TypeError('documentRef must provide addEventListener and removeEventListener.');
  }
  requireFunction(now, 'now');
  requireFunction(setTimeoutRef, 'setTimeoutRef');
  requireFunction(clearTimeoutRef, 'clearTimeoutRef');
  requireFunction(onInstruction, 'onInstruction');

  let running = false;
  let timerId = null;
  let scheduledActivationAt = null;
  let currentContinuity = continuity;

  function cancelTimer() {
    if (timerId !== null) {
      clearTimeoutRef(timerId);
      timerId = null;
    }
  }

  function evaluate() {
    if (!running) return null;
    cancelTimer();

    const instruction = createRepertoryControllerInstruction({
      now: now(),
      continuity: currentContinuity,
      documentVisible: isDocumentVisible(documentRef),
      prefersReducedMotion: reducedMotionPreference(matchMediaRef),
      scheduledActivationAt,
    });

    currentContinuity = instruction.continuity;
    onInstruction(instruction);

    if (instruction.action === 'suspend_timer') return instruction;

    scheduledActivationAt = instruction.transition?.activation_at ?? new Date(Date.parse(instruction.observed_at) + instruction.timer_delay_ms).toISOString();
    timerId = setTimeoutRef(evaluate, instruction.timer_delay_ms);
    return instruction;
  }

  function handleVisibilityChange() {
    evaluate();
  }

  return Object.freeze({
    start() {
      if (running) return null;
      running = true;
      documentRef.addEventListener('visibilitychange', handleVisibilityChange);
      return evaluate();
    },
    stop() {
      if (!running) return false;
      running = false;
      cancelTimer();
      documentRef.removeEventListener('visibilitychange', handleVisibilityChange);
      return true;
    },
    refresh() {
      return evaluate();
    },
    updateContinuity(nextContinuity) {
      currentContinuity = nextContinuity;
      return evaluate();
    },
    snapshot() {
      return Object.freeze({
        running,
        timer_active: timerId !== null,
        scheduled_activation_at: scheduledActivationAt,
        continuity: currentContinuity,
        media: Object.freeze({ autoplay: false, audio_start_requires_user_gesture: true }),
        rollback: Object.freeze({ reversible: true, import_boundary: './operations/studio/repertory-browser-adapter.mjs' }),
      });
    },
  });
}
