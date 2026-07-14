const HOUR_MS = 60 * 60 * 1000;

export const STUDIO_REPERTORY = Object.freeze([
  Object.freeze({ id: 'weather-room', film: 'The Weather Room', mode: 'weather', tempo: 'breathing' }),
  Object.freeze({ id: 'archive-lantern', film: 'Archive Lantern', mode: 'archive', tempo: 'drifting' }),
  Object.freeze({ id: 'comet-garden', film: 'Comet Garden', mode: 'garden', tempo: 'orbiting' }),
  Object.freeze({ id: 'blueprint-dream', film: 'Blueprint Dream', mode: 'blueprint', tempo: 'measured' }),
  Object.freeze({ id: 'machine-tide', film: 'Machine Tide', mode: 'machine', tempo: 'pulsing' }),
  Object.freeze({ id: 'velvet-observatory', film: 'Velvet Observatory', mode: 'observatory', tempo: 'watching' }),
  Object.freeze({ id: 'storm-edit', film: 'Storm Edit', mode: 'storm', tempo: 'cutting' }),
  Object.freeze({ id: 'afterimage-theater', film: 'Afterimage Theater', mode: 'theater', tempo: 'lingering' }),
]);

export function repertoryIndexAt(value = Date.now(), length = STUDIO_REPERTORY.length) {
  const timestamp = value instanceof Date ? value.getTime() : Number(value);
  if (!Number.isFinite(timestamp)) throw new TypeError('A finite time is required.');
  if (!Number.isInteger(length) || length < 1) throw new RangeError('Repertory length must be a positive integer.');
  return Math.floor(timestamp / HOUR_MS) % length;
}

export function productionAt(value = Date.now(), repertory = STUDIO_REPERTORY) {
  if (!Array.isArray(repertory) || repertory.length === 0) throw new RangeError('A non-empty repertory is required.');
  return repertory[repertoryIndexAt(value, repertory.length)];
}

export function millisecondsToNextHour(value = Date.now()) {
  const timestamp = value instanceof Date ? value.getTime() : Number(value);
  if (!Number.isFinite(timestamp)) throw new TypeError('A finite time is required.');
  return HOUR_MS - (timestamp % HOUR_MS) || HOUR_MS;
}

export function applyStudioProduction(documentRef, production, now = Date.now()) {
  const root = documentRef?.documentElement;
  if (!root || !production) return null;
  root.dataset.studioProduction = production.id;
  root.dataset.studioMode = production.mode;
  root.dataset.studioTempo = production.tempo;
  root.style.setProperty('--studio-hour-phase', String(repertoryIndexAt(now, 24) / 23));
  documentRef.dispatchEvent?.(new CustomEvent('mirror:productionchange', { detail: { ...production, at: Number(now) } }));
  return production;
}

export function installStudioRepertoryRuntime({ windowRef = window, documentRef = document, repertory = STUDIO_REPERTORY } = {}) {
  let timer = null;
  let stopped = false;

  const stage = () => {
    if (stopped) return null;
    const now = Date.now();
    const production = productionAt(now, repertory);
    applyStudioProduction(documentRef, production, now);
    windowRef.clearTimeout(timer);
    timer = windowRef.setTimeout(stage, millisecondsToNextHour(now) + 25);
    return production;
  };

  const current = stage();
  const stop = () => {
    stopped = true;
    windowRef.clearTimeout(timer);
  };

  windowRef.__mirrorStudio = Object.freeze({ repertory, current: () => productionAt(Date.now(), repertory), stop });
  return { current, stop };
}
