function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be a plain object.`);
  return value;
}

function requireText(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${label} must be a non-empty string.`);
  return value.trim();
}

function escapeSelectorValue(value) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function getFocusToken(root, documentRef) {
  const active = documentRef?.activeElement;
  if (!active || active === documentRef.body || !root.contains(active)) return null;
  const explicit = active.getAttribute?.('data-focus-key') || active.id;
  if (explicit) return Object.freeze({ kind: 'key', value: explicit });
  return null;
}

function restoreFocus(root, token) {
  if (!token) return true;
  const selector = `[data-focus-key="${escapeSelectorValue(token.value)}"],#${escapeSelectorValue(token.value)}`;
  const target = root.querySelector(selector);
  if (!target || typeof target.focus !== 'function') return false;
  target.focus({ preventScroll: true });
  return true;
}

function assertProjection(projection) {
  requireObject(projection, 'Projection');
  requireObject(projection.production, 'Projection production');
  requireObject(projection.continuity, 'Projection continuity');
  requireObject(projection.policy, 'Projection policy');
  if (projection.policy.autoplay !== false || projection.policy.audio_enabled !== false) {
    throw new Error('Stage projection must prohibit autoplay and begin with audio disabled.');
  }
  return Object.freeze({
    productionId: requireText(projection.production.id, 'Production id'),
    renderer: requireText(projection.production.renderer, 'Production renderer'),
    mountKey: requireText(projection.mount_key, 'Mount key'),
    continuityId: requireText(projection.continuity.id, 'Continuity id'),
    continuityRevision: requireText(projection.continuity.revision, 'Continuity revision'),
  });
}

/**
 * Creates the sole browser-facing stage boundary for repertory productions.
 * Renderers receive only the public controller projection and a fresh mount.
 */
export function createDomStageAdapter({ root, renderers, document_ref: documentRef = globalThis.document }) {
  requireObject(renderers, 'Renderer registry');
  if (!root || typeof root.replaceChildren !== 'function' || typeof root.querySelector !== 'function') {
    throw new TypeError('Stage root must be a DOM-like element.');
  }
  if (!documentRef || typeof documentRef.createElement !== 'function') throw new TypeError('A DOM-like document is required.');

  return async function stage(projection) {
    const identity = assertProjection(projection);
    const renderer = renderers[identity.renderer];
    if (typeof renderer !== 'function') throw new Error(`Missing renderer: ${identity.renderer}.`);

    const focusToken = getFocusToken(root, documentRef);
    const previous = root.firstElementChild;
    const mount = documentRef.createElement('section');
    mount.setAttribute('data-repertory-mount', identity.mountKey);
    mount.setAttribute('data-production-id', identity.productionId);
    mount.setAttribute('data-continuity-id', identity.continuityId);
    mount.setAttribute('data-continuity-revision', identity.continuityRevision);
    mount.setAttribute('data-motion', projection.policy.motion_enabled ? 'enabled' : 'reduced');
    mount.setAttribute('aria-label', projection.production.title || identity.productionId);

    const renderResult = await renderer({ mount, projection });
    if (renderResult && renderResult.autoplay === true) throw new Error('Renderer attempted to enable autoplay.');
    for (const media of mount.querySelectorAll?.('audio,video') || []) {
      media.autoplay = false;
      media.removeAttribute?.('autoplay');
      media.pause?.();
    }

    root.replaceChildren(mount);
    const focusPreserved = restoreFocus(root, focusToken);
    const rollbackSelector = `[data-repertory-mount="${escapeSelectorValue(identity.mountKey)}"]`;

    return Object.freeze({
      staged: true,
      reversible: true,
      production_id: identity.productionId,
      mount_key: identity.mountKey,
      continuity_id: identity.continuityId,
      continuity_revision: identity.continuityRevision,
      operation: previous ? 'replace_stage' : 'mount_stage',
      focus_preserved: focusPreserved,
      content_strategy: projection.policy.motion_enabled ? 'animated_public_projection' : 'reduced_motion_public_projection',
      rollback_selector: rollbackSelector,
    });
  };
}
