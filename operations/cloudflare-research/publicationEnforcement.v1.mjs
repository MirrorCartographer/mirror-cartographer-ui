import { assessPublicationPacket } from './publicationBoundary.v1.mjs';

const SAFE_RESPONSE_HEADERS = Object.freeze({
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow, noarchive'
});

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

export function authorizeStaticAsset(packet, render) {
  const assessment = assessPublicationPacket(packet);
  if (!assessment.publishable) return deny('static_asset', assessment);
  if (typeof render !== 'function') throw new TypeError('render must be a function');
  return { allowed: true, kind: 'static_asset', artifact: render(packet), assessment };
}

export function authorizeWorkerResponse(packet, render) {
  const assessment = assessPublicationPacket(packet);
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
