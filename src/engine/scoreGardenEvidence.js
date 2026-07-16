const STORAGE_KEY = 'fia-score-garden-evidence-v1';
const MAX_RECORDS = 180;

const ALLOWED = new Set([
  'audio_consent', 'seed_planted', 'branch_grown', 'score_played', 'score_stopped',
  'garden_reset', 'evidence_exported', 'evidence_erased', 'accessibility_mode', 'error'
]);

const FIELDS = new Set([
  'type', 'seed_family', 'growth_band', 'note_count_band', 'duration_band',
  'input_class', 'audio_state', 'accessibility_mode', 'error_code'
]);

export function bandCount(value) {
  if (value <= 0) return '0';
  if (value <= 3) return '1-3';
  if (value <= 7) return '4-7';
  return '8+';
}

export function bandDuration(ms) {
  if (ms < 15000) return 'under-15s';
  if (ms < 60000) return '15-59s';
  if (ms < 300000) return '1-4m';
  return '5m+';
}

export function sanitizeDelta(input = {}) {
  if (!ALLOWED.has(input.type)) return null;
  const clean = { schema: 'fia.interaction.delta/1', feature: 'generative-score-garden' };
  for (const [key, value] of Object.entries(input)) {
    if (FIELDS.has(key) && ['string', 'number', 'boolean'].includes(typeof value)) clean[key] = value;
  }
  return clean;
}

export function readEvidence() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}

export function recordEvidence(delta) {
  const clean = sanitizeDelta(delta);
  if (!clean) return false;
  const records = readEvidence();
  records.push(clean);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(-MAX_RECORDS)));
  return true;
}

export function eraseEvidence() {
  localStorage.removeItem(STORAGE_KEY);
}

export function exportEvidence() {
  return {
    schema: 'fia.reader.interaction-evidence/1',
    feature: 'generative-score-garden',
    privacy: {
      local_only: true,
      raw_text: false,
      identity: false,
      microphone: false,
      exact_pointer_path: false
    },
    records: readEvidence()
  };
}
