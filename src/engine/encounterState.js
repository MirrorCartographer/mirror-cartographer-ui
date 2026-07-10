const clamp01 = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

export function createEncounterState(origin = Date.now()) {
  let firstSeen = origin;
  let lastSeen = 0;
  let count = 0;
  let repeats = 0;
  let lastPoint = null;

  function observe(input = {}) {
    const now = Number.isFinite(input.now) ? input.now : Date.now();
    const point = input.point && Number.isFinite(input.point.x) && Number.isFinite(input.point.y)
      ? { x: clamp01(input.point.x), y: clamp01(input.point.y) }
      : null;
    const gapMs = lastSeen ? Math.max(0, now - lastSeen) : Math.max(0, now - firstSeen);
    const distance = point && lastPoint
      ? Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y)
      : 0;

    count += 1;
    if (gapMs < 700 && distance < 0.08) repeats += 1;
    lastSeen = now;
    if (point) lastPoint = point;

    const dwellMs = Math.max(0, now - firstSeen);
    const tapVelocity = clamp01(1 - Math.min(gapMs, 1800) / 1800);
    const repetition = clamp01(repeats / Math.max(1, count - 1));
    const exploration = clamp01(distance / 0.45);
    const hesitation = clamp01(Math.min(gapMs, 6000) / 6000);

    return {
      count,
      dwellMs,
      tapVelocity,
      repetition,
      exploration,
      hesitation,
      returnCount: Math.max(0, count - 1),
    };
  }

  function snapshot(now = Date.now()) {
    return {
      count,
      dwellMs: Math.max(0, now - firstSeen),
      repetition: clamp01(repeats / Math.max(1, count - 1)),
      returnCount: Math.max(0, count - 1),
    };
  }

  return { observe, snapshot };
}
