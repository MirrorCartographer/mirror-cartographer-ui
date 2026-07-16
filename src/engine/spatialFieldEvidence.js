const STORAGE_KEY = 'fia-spatial-field-evidence-v1';
const SCHEMA = 'fia.interaction.delta/1';
const ALLOWED = new Set([
  'audio_consent', 'body_moved', 'body_played', 'field_played',
  'field_stopped', 'field_reset', 'evidence_exported', 'evidence_erased',
  'accessibility_mode', 'error'
]);

const clampBand = (value) => value < 0.34 ? 'low' : value < 0.67 ? 'mid' : 'high';
const durationBand = (ms) => ms < 30000 ? '<30s' : ms < 120000 ? '30-120s' : ms < 600000 ? '2-10m' : '10m+';

export function sanitizeSpatialDelta(type, detail = {}) {
  if (!ALLOWED.has(type)) return null;
  const record = { schema: SCHEMA, type, at: new Date().toISOString() };
  if (Number.isFinite(detail.x)) record.pan_band = clampBand(detail.x);
  if (Number.isFinite(detail.y)) record.height_band = clampBand(detail.y);
  if (Number.isFinite(detail.distance)) record.distance_band = clampBand(detail.distance);
  if (Number.isFinite(detail.count)) record.body_count_band = detail.count < 2 ? '1' : detail.count < 4 ? '2-3' : '4+';
  if (Number.isFinite(detail.durationMs)) record.duration_band = durationBand(detail.durationMs);
  if (typeof detail.input === 'string' && ['keyboard', 'pointer', 'touch', 'button'].includes(detail.input)) record.input = detail.input;
  if (typeof detail.mode === 'string' && ['reduced-motion', 'high-contrast', 'sound-off'].includes(detail.mode)) record.mode = detail.mode;
  if (typeof detail.code === 'string') record.code = detail.code.slice(0, 48).replace(/[^a-z0-9_-]/gi, '');
  return record;
}

export function appendSpatialDelta(type, detail) {
  const record = sanitizeSpatialDelta(type, detail);
  if (!record || typeof localStorage === 'undefined') return record;
  try {
    const ledger = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ledger, record].slice(-180)));
  } catch { /* local evidence is optional */ }
  return record;
}

export function exportSpatialEvidence() {
  const events = typeof localStorage === 'undefined' ? [] : JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  return { schema: 'fia.reader.interaction-evidence/1', source: 'spatial-sound-field', privacy: 'local-user-export', events };
}

export function eraseSpatialEvidence() {
  if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY);
}
