const TRACE_POINTS = Object.freeze([
  Object.freeze({ x: 0.18, y: 0.62 }),
  Object.freeze({ x: 0.34, y: 0.24 }),
  Object.freeze({ x: 0.58, y: 0.18 }),
  Object.freeze({ x: 0.78, y: 0.42 }),
  Object.freeze({ x: 0.68, y: 0.76 }),
  Object.freeze({ x: 0.44, y: 0.84 }),
  Object.freeze({ x: 0.22, y: 0.74 }),
  Object.freeze({ x: 0.18, y: 0.62 })
]);

function assertVisit(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError('visit must be a non-negative safe integer');
  }
}

export function traceForVisit(visit) {
  assertVisit(visit);
  const completedCycles = Math.floor(visit / 8);
  const step = visit % 8;
  const visibleCount = visit === 0 ? 0 : step === 0 ? TRACE_POINTS.length : step + 1;
  const points = TRACE_POINTS.slice(0, visibleCount);
  const closed = visibleCount === TRACE_POINTS.length;

  return Object.freeze({
    visit,
    cycle: completedCycles,
    step,
    closed,
    points: Object.freeze(points),
    description: visit === 0
      ? 'No trace has been drawn.'
      : closed
        ? `Trace ${completedCycles} is complete.`
        : `Trace ${completedCycles + 1} contains ${Math.max(0, visibleCount - 1)} of 7 segments.`
  });
}

export const ROOM_TRACE_VERSION = '1.0.0';
