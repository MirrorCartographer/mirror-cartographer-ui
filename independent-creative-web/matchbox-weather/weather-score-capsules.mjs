export const WEATHER = ['ash', 'rain', 'moths', 'static'];

export function encodeScore(cells) {
  if (!Array.isArray(cells) || cells.length !== 16) throw new Error('score_must_have_16_cells');
  const digits = cells.map((cell) => {
    if (cell === '') return '0';
    const index = WEATHER.indexOf(cell);
    if (index < 0) throw new Error('unknown_weather');
    return String(index + 1);
  }).join('');
  return `ws1.${digits}`;
}

export function decodeScore(token) {
  if (typeof token !== 'string' || !/^ws1\.[0-4]{16}$/.test(token)) throw new Error('invalid_score_capsule');
  return [...token.slice(4)].map((digit) => digit === '0' ? '' : WEATHER[Number(digit) - 1]);
}

export function scoreFromHash(hash) {
  const raw = String(hash || '').replace(/^#/, '');
  if (!raw) return null;
  return decodeScore(raw);
}
