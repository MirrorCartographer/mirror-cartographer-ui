import { assessPublicationPacket } from './publicationBoundary.v2.mjs';
import { SAFE_RESPONSE_HEADERS } from './publicationEnforcement.v1.mjs';

function deny(kind, assessment) {
  return {
    allowed: false,
    kind,
    status: kind === 'worker_response' ? 404 : null,
    headers: kind === 'worker_response' ? SAFE_RESPONSE_HEADERS : {},
    body: kind === 'worker_response' ? 'Not found' : null,
    artifact: null,
    assessment
  };
}

export function authorizeStaticAsset(packet, render, options = {}) {
  const assessment = assessPublicationPacket(packet, options);
  if (!assessment.publishable) return deny('static_asset', assessment);
  if (typeof render !== 'function') throw new TypeError('render must be a function');
  return { allowed: true, kind: 'static_asset', artifact: render(packet), assessment };
}

export function authorizeWorkerResponse(packet, render, options = {}) {
  const assessment = assessPublicationPacket(packet, options);
  if (!assessment.publishable) return deny('worker_response', assessment);
  if (typeof render !== 'function') throw new TypeError('render must be a function');
  const rendered = render(packet);
  if (!rendered || typeof rendered !== 'object' || typeof rendered.body !== 'string') {
    throw new TypeError('worker render must return an object with a string body');
  }
  return {
    allowed: true,
    kind: 'worker_response',
    status: Number.isInteger(rendered.status) ? rendered.status : 200,
    headers: { ...(rendered.headers || {}), ...SAFE_RESPONSE_HEADERS },
    body: rendered.body,
    artifact: null,
    assessment
  };
}

export { SAFE_RESPONSE_HEADERS };
