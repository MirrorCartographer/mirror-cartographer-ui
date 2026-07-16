const KEY = 'fia-visual-grammar-evidence-v1';
const ALLOWED = new Set(['grammar_token_added','grammar_token_removed','motif_played','audio_consent','motif_exported','grammar_cleared','error']);
const FIELDS = new Set(['shape','direction','intensityBand','tokenCountBand','consent','errorCode']);

const bandCount = (count) => count === 0 ? '0' : count <= 3 ? '1-3' : count <= 7 ? '4-7' : '8+';

export function sanitizeGrammarDelta(type, detail = {}) {
  if (!ALLOWED.has(type)) throw new Error('unsupported evidence type');
  const clean = {};
  Object.entries(detail).forEach(([key, value]) => {
    if (FIELDS.has(key) && ['string','boolean','number'].includes(typeof value)) clean[key] = value;
  });
  if ('tokenCount' in detail) clean.tokenCountBand = bandCount(Number(detail.tokenCount) || 0);
  return { schema: 'fia.interaction.delta/1', surface: 'visual-music-grammar', type, detail: clean, at: new Date().toISOString() };
}

export function recordGrammarDelta(type, detail) {
  const delta = sanitizeGrammarDelta(type, detail);
  try {
    const existing = JSON.parse(localStorage.getItem(KEY) || '[]');
    localStorage.setItem(KEY, JSON.stringify([...existing, delta].slice(-160)));
  } catch {}
  return delta;
}

export function exportGrammarEvidence() {
  const events = JSON.parse(localStorage.getItem(KEY) || '[]');
  return { schema: 'fia.reader.interaction-evidence/1', privacy: { localOnly: true, rawText: false, identity: false, microphone: false }, events };
}

export function eraseGrammarEvidence() { localStorage.removeItem(KEY); }
