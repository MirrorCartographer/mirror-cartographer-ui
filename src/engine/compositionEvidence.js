const KEY = 'fia-composition-evidence-v1';
const MAX_EVENTS = 240;
const ALLOWED = new Set(['audio_consent','playback_start','playback_stop','step_toggle','motif_mutate','score_clear','tempo_change','density_change','room_enter','room_exit','evidence_export','evidence_clear','accessibility_mode']);

function read() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function bucketDuration(ms) {
  if (ms < 15_000) return 'under_15s';
  if (ms < 60_000) return '15_to_60s';
  if (ms < 300_000) return '1_to_5m';
  return 'over_5m';
}

export function recordCompositionEvent(type, delta = {}) {
  if (!ALLOWED.has(type)) return;
  const safeDelta = Object.fromEntries(Object.entries(delta).filter(([key, value]) =>
    ['track','step','enabled','tempoBand','densityBand','changedCells','mode','durationBucket','source'].includes(key)
    && ['string','number','boolean'].includes(typeof value)
  ));
  const events = read();
  events.push({ schema: 'fia.interaction.delta/1', type, at: new Date().toISOString(), delta: safeDelta });
  localStorage.setItem(KEY, JSON.stringify(events.slice(-MAX_EVENTS)));
}

export function exportCompositionEvidence(sessionStartedAt) {
  const payload = {
    schema: 'fia.reader.interaction-evidence/1',
    generatedAt: new Date().toISOString(),
    privacy: {
      localOnly: true,
      containsIdentity: false,
      containsRawText: false,
      containsAudio: false,
      userInitiatedExport: true,
    },
    session: { durationBucket: bucketDuration(Date.now() - sessionStartedAt) },
    events: read(),
  };
  recordCompositionEvent('evidence_export', { source: 'composition_world' });
  return payload;
}

export function clearCompositionEvidence() {
  localStorage.removeItem(KEY);
}

export function evidenceCount() {
  return read().length;
}
