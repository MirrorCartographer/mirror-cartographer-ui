import { createPublicRepertoryRuntime } from '../../operations/studio/repertory-runtime.mjs';

const CONTINUITY = Object.freeze({
  id: 'mirror-cartographer-public-continuity',
  revision: '1',
});

function appendText(documentRef, mount, tagName, text, className) {
  const node = documentRef.createElement(tagName);
  node.textContent = text;
  if (className) node.setAttribute('class', className);
  mount.append(node);
  return node;
}

function createRenderer(documentRef, label, description) {
  return async ({ mount, projection }) => {
    mount.setAttribute('data-repertory-renderer', projection.production.renderer);
    appendText(documentRef, mount, 'p', label, 'repertory-kicker');
    appendText(documentRef, mount, 'h1', projection.production.title, 'repertory-title');
    appendText(documentRef, mount, 'p', description, 'repertory-description');

    const field = documentRef.createElement('div');
    field.setAttribute('class', 'repertory-field');
    field.setAttribute('aria-hidden', 'true');
    for (let index = 0; index < 12; index += 1) {
      const mark = documentRef.createElement('span');
      mark.setAttribute('data-mark', String(index));
      field.append(mark);
    }
    mount.append(field);
    return Object.freeze({ autoplay: false });
  };
}

export function createPublicRendererRegistry(documentRef = globalThis.document) {
  return Object.freeze({
    coordinateBloom: createRenderer(documentRef, 'Coordinate field', 'Marks gather into a temporary coordinate and release.'),
    paperWeather: createRenderer(documentRef, 'Material forecast', 'Layered paper fronts cross a hand-cut horizon.'),
    signalGarden: createRenderer(documentRef, 'Living signal', 'Signals grow and cross while continuity stays fixed.'),
    nightIndex: createRenderer(documentRef, 'Nocturnal archive', 'Unlabelled lights open and close as an index.'),
    hingeTheatre: createRenderer(documentRef, 'Reversible scene', 'Panels pivot around one quiet axis.'),
    softMachineRoom: createRenderer(documentRef, 'Visible mechanism', 'A soft diagram breathes without becoming a dashboard.'),
  });
}

/**
 * Opt-in application boundary. Existing production rendering remains untouched
 * unless a dedicated element with data-repertory-stage is present.
 */
export async function installPublicRepertoryRuntime({
  document_ref: documentRef = globalThis.document,
  match_media: matchMedia = globalThis.matchMedia,
  clock = () => new Date(),
} = {}) {
  const root = documentRef?.querySelector?.('[data-repertory-stage]');
  if (!root) {
    return Object.freeze({ installed: false, reason: 'stage_absent' });
  }

  const runtime = createPublicRepertoryRuntime({
    root,
    renderers: createPublicRendererRegistry(documentRef),
    continuity: CONTINUITY,
    document_ref: documentRef,
    match_media: matchMedia,
    clock,
  });
  const presentation = await runtime.present();

  return Object.freeze({
    installed: true,
    continuity: CONTINUITY,
    presentation,
    rollback() {
      const mount = root.querySelector(presentation.runtime.rollback_selector);
      if (mount) mount.remove();
      return Object.freeze({ rolled_back: Boolean(mount) });
    },
  });
}
