import { createRepertoryMountPlan } from './repertory-mount-plan.mjs';
import { applyRepertoryMountPlan } from './repertory-dom-adapter.mjs';

function requireText(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} must be a non-empty string.`);
  return value.trim();
}

/**
 * Converts one public repertory projection into a mount plan and applies it as
 * a single fail-closed transaction. Identity is checked before and after DOM
 * mutation so a production cannot be staged under a mismatched mount key.
 */
export function stageRepertoryProjection(document, projection, options = {}) {
  const plan = createRepertoryMountPlan(projection, options);
  const projectedProductionId = requireText(projection?.production?.id, 'Projection production id');
  const projectedMountKey = requireText(projection?.mount_key, 'Projection mount key');

  if (plan.identity.production_id !== projectedProductionId || plan.identity.mount_key !== projectedMountKey) {
    throw new Error('Mount plan identity diverged from the public projection.');
  }
  if (plan.attributes['data-production-id'] !== plan.identity.production_id) {
    throw new Error('Mount plan DOM identity diverged from its declared production identity.');
  }

  const result = applyRepertoryMountPlan(document, plan);
  if (!result.applied) {
    return Object.freeze({
      staged: false,
      reason: result.reason,
      operation: result.operation,
      production_id: projectedProductionId,
      mount_key: projectedMountKey,
    });
  }

  const root = document.querySelector(plan.target.selector);
  if (!root || root.attrs?.get?.('data-production-id') && root.attrs.get('data-production-id') !== projectedProductionId) {
    throw new Error('Applied DOM identity could not be verified.');
  }
  if (typeof root.getAttribute === 'function' && root.getAttribute('data-production-id') !== projectedProductionId) {
    throw new Error('Applied DOM identity could not be verified.');
  }

  return Object.freeze({
    staged: true,
    operation: result.operation,
    production_id: projectedProductionId,
    mount_key: projectedMountKey,
    focus_preserved: result.focus_preserved,
    content_strategy: result.content_strategy,
    reversible: plan.rollback.reversible === true,
    rollback_selector: plan.rollback.remove_selector,
  });
}
