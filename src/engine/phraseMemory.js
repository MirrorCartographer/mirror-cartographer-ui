const clamp01 = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
const finiteOr = (value, fallback = 0) => (Number.isFinite(value) ? value : fallback);

export function createPhraseMemory(limit = 8) {
  const max = Math.max(1, Math.min(16, Math.floor(finiteOr(limit, 8))));
  const frames = [];

  function remember(frame = {}) {
    const contour = {
      beat: Math.max(0, Math.floor(finiteOr(frame.beat, 0))),
      phase: clamp01(frame.phase),
      phrase: Math.max(0, Math.floor(finiteOr(frame.phrase, 0))),
      energy: clamp01(frame.pulse ?? frame.energy),
      rhythm: Math.max(0, finiteOr(frame.rhythm, 0)),
      state: typeof frame.state === 'string' ? frame.state : 'cloud',
    };

    frames.push(contour);
    if (frames.length > max) frames.shift();
    return contour;
  }

  function snapshot() {
    return frames.map((frame) => ({ ...frame }));
  }

  function contour() {
    if (!frames.length) return { length: 0, rise: 0, turn: 0, density: 0 };
    const first = frames[0];
    const last = frames.at(-1);
    let turn = 0;
    for (let i = 1; i < frames.length; i += 1) {
      turn += Math.abs(frames[i].phase - frames[i - 1].phase);
    }
    return {
      length: frames.length,
      rise: clamp01(last.energy - first.energy + 0.5),
      turn: clamp01(turn / Math.max(1, frames.length - 1)),
      density: clamp01(frames.reduce((sum, frame) => sum + frame.rhythm, 0) / (frames.length * 12)),
    };
  }

  return { remember, snapshot, contour };
}
