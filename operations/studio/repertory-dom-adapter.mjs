const MANAGED_ATTRIBUTES = Object.freeze([
  'data-production-id',
  'data-production-form',
  'data-continuity-channel',
  'data-continuity-revision',
  'role',
  'aria-label',
  'aria-live',
]);

function requireSafePlan(plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) throw new TypeError('Mount plan must be an object.');
  if (plan.schema_version !== 1) throw new RangeError('Unsupported mount plan schema version.');
  if (!['replace', 'suspend'].includes(plan.operation)) throw new RangeError('Unsupported mount operation.');
  if (!plan.target || typeof plan.target.selector !== 'string' || !plan.target.selector.trim()) throw new TypeError('Mount selector is required.');
  if (!plan.behavior || plan.behavior.preserve_focus !== true || plan.behavior.focus_target !== null) throw new RangeError('Focus preservation is required.');
  if (plan.behavior.autoplay !== false || plan.behavior.audio_start_requires_user_gesture !== true) throw new RangeError('Unsafe media behavior.');
  if (plan.behavior.network_requests !== false || plan.behavior.persistence !== false) throw new RangeError('External side effects are forbidden.');
  if (!plan.content || typeof plan.content.heading !== 'string' || typeof plan.content.visual_grammar !== 'string' || typeof plan.content.status !== 'string') {
    throw new TypeError('Mount content is incomplete.');
  }
  return plan;
}

function setManagedAttributes(root, attributes) {
  for (const name of MANAGED_ATTRIBUTES) {
    const value = attributes?.[name];
    if (value === undefined || value === null || value === false) root.removeAttribute(name);
    else root.setAttribute(name, String(value));
  }
  root.inert = Boolean(attributes?.inert);
}

function ensureTextNode(document, root, selector, tagName, marker, text) {
  let node = root.querySelector(selector);
  if (!node) {
    node = document.createElement(tagName);
    node.setAttribute(marker, '');
    root.append(node);
  }
  node.textContent = text;
  return node;
}

/**
 * Applies a validated repertory mount plan without replacing the root or a
 * focused descendant. It performs no network, storage, media, or HTML parsing.
 */
export function applyRepertoryMountPlan(document, inputPlan) {
  const plan = requireSafePlan(inputPlan);
  if (!document || typeof document.querySelector !== 'function' || typeof document.createElement !== 'function') {
    throw new TypeError('A DOM-compatible document is required.');
  }

  const root = document.querySelector(plan.target.selector);
  if (!root) return Object.freeze({ applied: false, reason: 'target_missing', operation: plan.operation });

  const active = document.activeElement;
  const focusInside = Boolean(active && active !== document.body && typeof root.contains === 'function' && root.contains(active));
  setManagedAttributes(root, plan.attributes);

  if (plan.operation === 'suspend') {
    root.setAttribute('data-repertory-suspended', 'true');
    return Object.freeze({ applied: true, operation: 'suspend', focus_preserved: true, content_strategy: 'retained' });
  }

  root.removeAttribute('data-repertory-suspended');
  ensureTextNode(document, root, '[data-repertory-heading]', 'h1', 'data-repertory-heading', plan.content.heading);
  ensureTextNode(document, root, '[data-repertory-grammar]', 'p', 'data-repertory-grammar', plan.content.visual_grammar);
  ensureTextNode(document, root, '[data-repertory-status]', 'p', 'data-repertory-status', plan.content.status);

  return Object.freeze({
    applied: true,
    operation: 'replace',
    focus_preserved: document.activeElement === active,
    content_strategy: focusInside ? 'in_place_focused' : 'in_place',
  });
}
