const MAX_OBSERVATIONS = 64;
const ALLOWED_KINDS = new Set([
  'pointer-position', 'pointer-touch', 'pointer-leave', 'pointer-stillness', 'character-focus', 'submitted-language', 'resident-choice',
  'page-visibility', 'window-focus', 'audio-envelope', 'microphone-state'
]);
const listeners = new Set();
const observations = [];

function safeValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.slice(0, 80);
  if (value && Object.getPrototypeOf(value) === Object.prototype
    && Number.isFinite(value.x) && Number.isFinite(value.y)
    && Object.keys(value).every((key) => key === 'x' || key === 'y')) {
    return Object.freeze({
      x: Math.max(0, Math.min(1, value.x)),
      y: Math.max(0, Math.min(1, value.y))
    });
  }
  return null;
}

/**
 * Ephemeral, local-only observation stream.
 * It deliberately rejects raw media, transcripts, identity claims and arbitrary payloads.
 */
export function publishPerceptionObservation(input = {}) {
  if (!ALLOWED_KINDS.has(input.kind)) throw new TypeError('Unsupported perception observation.');
  const value = safeValue(input.value);
  if (value === null && input.value !== null && input.value !== undefined) throw new TypeError('Perception values must be bounded scalar data or normalized coordinates.');
  const now = Date.now();
  const observation = Object.freeze({
    id: `obs-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    kind: input.kind,
    source: String(input.source || 'unknown').slice(0, 40),
    permission: String(input.permission || 'not-required').slice(0, 40),
    value,
    confidence: Number.isFinite(input.confidence) ? Math.max(0, Math.min(1, input.confidence)) : 1,
    observedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + Math.max(250, Math.min(30000, input.ttlMs || 5000))).toISOString(),
    scope: 'local-only',
    retention: 'ephemeral'
  });
  observations.push(observation);
  while (observations.length > MAX_OBSERVATIONS) observations.shift();
  for (const listener of listeners) {
    try { listener(observation); } catch { /* observers cannot interrupt perception */ }
  }
  return observation;
}

export function subscribePerceptionObservations(listener) {
  if (typeof listener !== 'function') throw new TypeError('A perception listener must be a function.');
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPerceptionSnapshot() {
  const now = Date.now();
  return observations.filter((item) => Date.parse(item.expiresAt) > now);
}

export function clearPerceptionObservations() {
  observations.length = 0;
}
