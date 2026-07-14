import { getControllerProductions } from './public-repertory-catalog.mjs';
import { createRepertoryController } from './repertory-controller.mjs';
import { createDomStageAdapter } from './repertory-dom-stage-adapter.mjs';

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be a plain object.`);
  return value;
}

function resolveHour(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new TypeError('Observed date must be a valid Date.');
  return date.getHours();
}

/**
 * Composes the public catalog, deterministic controller, and sole DOM stage
 * adapter into one reversible browser runtime. The caller owns the timer and
 * decides when to present again; this module never autoplays or self-schedules.
 */
export function createPublicRepertoryRuntime({
  root,
  renderers,
  continuity,
  document_ref: documentRef = globalThis.document,
  match_media: matchMedia = globalThis.matchMedia,
  clock = () => new Date(),
}) {
  requireObject(continuity, 'Continuity state');
  const stage = createDomStageAdapter({ root, renderers, document_ref: documentRef });
  const controller = createRepertoryController({
    productions: getControllerProductions(),
    stage,
    continuity,
  });

  function reducedMotionPreferred() {
    if (typeof matchMedia !== 'function') return false;
    return matchMedia('(prefers-reduced-motion: reduce)')?.matches === true;
  }

  return Object.freeze({
    async present({ observed_at: observedAt = clock(), hour, reduced_motion: reducedMotion } = {}) {
      const observed = observedAt instanceof Date ? observedAt : new Date(observedAt);
      if (Number.isNaN(observed.getTime())) throw new TypeError('observed_at must resolve to a valid date.');
      const resolvedHour = hour === undefined ? resolveHour(observed) : hour;
      const result = await controller.present({
        hour: resolvedHour,
        observed_at: observed.toISOString(),
        reduced_motion: reducedMotion === undefined ? reducedMotionPreferred() : reducedMotion === true,
      });
      return Object.freeze({
        ...result,
        runtime: Object.freeze({
          deterministic: true,
          self_scheduled: false,
          autoplay: false,
          hour: resolvedHour,
          rollback_selector: result.receipt.rollback.selector,
        }),
      });
    },
  });
}
