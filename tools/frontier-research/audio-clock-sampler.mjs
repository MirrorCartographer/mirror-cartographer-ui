function finiteNonNegative(value, name) {
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError(`${name} must be a finite non-negative number`);
  }
  return value;
}

function observableLatency(context, key) {
  const value = context?.[key];
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function captureAudioClockSample(context, performanceClock = globalThis.performance) {
  if (!context || typeof context !== 'object') throw new TypeError('context must be an object');
  if (!performanceClock || typeof performanceClock.now !== 'function') {
    throw new TypeError('performanceClock.now must be a function');
  }
  if (typeof context.getOutputTimestamp !== 'function') {
    return {
      status: 'unavailable',
      reason: 'getOutputTimestamp_unavailable',
      sampledAtPerformanceTime: finiteNonNegative(performanceClock.now(), 'sampledAtPerformanceTime')
    };
  }

  const sampledAtPerformanceTime = finiteNonNegative(performanceClock.now(), 'sampledAtPerformanceTime');
  const timestamp = context.getOutputTimestamp();
  if (!timestamp || typeof timestamp !== 'object') throw new TypeError('getOutputTimestamp must return an object');

  return {
    status: 'observed',
    contextTime: finiteNonNegative(timestamp.contextTime, 'contextTime'),
    performanceTime: finiteNonNegative(timestamp.performanceTime, 'performanceTime'),
    sampledAtPerformanceTime
  };
}

export async function sampleAudioClockSession(context, options = {}) {
  const performanceClock = options.performanceClock ?? globalThis.performance;
  const sampleCount = options.sampleCount ?? 3;
  const intervalMs = options.intervalMs ?? 50;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));

  if (!Number.isInteger(sampleCount) || sampleCount < 2) throw new RangeError('sampleCount must be an integer of at least 2');
  finiteNonNegative(intervalMs, 'intervalMs');
  if (typeof sleep !== 'function') throw new TypeError('sleep must be a function');

  const observations = [];
  for (let index = 0; index < sampleCount; index += 1) {
    observations.push(captureAudioClockSample(context, performanceClock));
    if (index < sampleCount - 1) await sleep(intervalMs);
  }

  const unavailable = observations.find((item) => item.status === 'unavailable');
  return {
    schemaVersion: 1,
    sourceStatus: 'runtime_observation',
    captureStatus: unavailable ? 'unavailable' : 'observed',
    contextState: typeof context.state === 'string' ? context.state : 'unknown',
    sampleRate: Number.isFinite(context.sampleRate) && context.sampleRate > 0 ? context.sampleRate : null,
    baseLatency: observableLatency(context, 'baseLatency'),
    outputLatency: observableLatency(context, 'outputLatency'),
    samples: observations.filter((item) => item.status === 'observed').map(({ status, ...sample }) => sample),
    unavailableReason: unavailable?.reason ?? null,
    claimBoundary: 'Browser clock capture does not prove route binding, acoustic output, or human audibility.'
  };
}

export async function sampleAndEvaluateAudioClock(context, evaluate, options = {}) {
  if (typeof evaluate !== 'function') throw new TypeError('evaluate must be a function');
  const captured = await sampleAudioClockSession(context, options);
  if (captured.captureStatus !== 'observed') {
    return { forwarded: false, captured, evaluation: null, reason: captured.unavailableReason };
  }

  const evaluation = evaluate({
    baseLatency: captured.baseLatency,
    outputLatency: captured.outputLatency,
    samples: captured.samples
  }, options.evaluatorOptions);

  const forwarded = evaluation?.classification === 'consistent';
  return {
    forwarded,
    captured,
    evaluation,
    reason: forwarded ? null : 'clock_evidence_not_consistent'
  };
}
