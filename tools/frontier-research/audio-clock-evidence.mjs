import { createHash } from 'node:crypto';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

export function digest(value) {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function finite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
}

export function evaluateAudioClockEvidence(input, options = {}) {
  if (!input || typeof input !== 'object') throw new TypeError('input must be an object');
  const samples = input.samples;
  if (!Array.isArray(samples) || samples.length < 2) throw new TypeError('at least two samples are required');

  const maxDriftMs = options.maxDriftMs ?? 25;
  const futureToleranceMs = options.futureToleranceMs ?? 5;
  finite(maxDriftMs, 'maxDriftMs');
  finite(futureToleranceMs, 'futureToleranceMs');
  if (maxDriftMs < 0 || futureToleranceMs < 0) throw new RangeError('tolerances must be non-negative');

  const normalized = samples.map((sample, index) => {
    if (!sample || typeof sample !== 'object') throw new TypeError(`samples[${index}] must be an object`);
    finite(sample.contextTime, `samples[${index}].contextTime`);
    finite(sample.performanceTime, `samples[${index}].performanceTime`);
    finite(sample.sampledAtPerformanceTime, `samples[${index}].sampledAtPerformanceTime`);
    if (sample.contextTime < 0 || sample.performanceTime < 0 || sample.sampledAtPerformanceTime < 0) {
      throw new RangeError(`samples[${index}] timestamps must be non-negative`);
    }
    return {
      contextTime: sample.contextTime,
      performanceTime: sample.performanceTime,
      sampledAtPerformanceTime: sample.sampledAtPerformanceTime
    };
  });

  const violations = [];
  const intervals = [];
  for (let index = 0; index < normalized.length; index += 1) {
    const sample = normalized[index];
    if (sample.performanceTime - sample.sampledAtPerformanceTime > futureToleranceMs) {
      violations.push({ code: 'output_timestamp_in_future', sample: index });
    }
    if (index === 0) continue;
    const previous = normalized[index - 1];
    const contextDeltaMs = (sample.contextTime - previous.contextTime) * 1000;
    const performanceDeltaMs = sample.performanceTime - previous.performanceTime;
    const observedDeltaMs = sample.sampledAtPerformanceTime - previous.sampledAtPerformanceTime;
    const driftMs = Math.abs(contextDeltaMs - performanceDeltaMs);
    intervals.push({ index, contextDeltaMs, performanceDeltaMs, observedDeltaMs, driftMs });
    if (contextDeltaMs < 0) violations.push({ code: 'context_time_regressed', sample: index });
    if (performanceDeltaMs < 0) violations.push({ code: 'performance_time_regressed', sample: index });
    if (observedDeltaMs < 0) violations.push({ code: 'sampling_clock_regressed', sample: index });
    if (driftMs > maxDriftMs) violations.push({ code: 'clock_delta_drift_exceeded', sample: index, driftMs });
  }

  const latency = {};
  for (const key of ['baseLatency', 'outputLatency']) {
    const value = input[key];
    if (value === undefined || value === null) latency[key] = { status: 'unobservable' };
    else {
      finite(value, key);
      if (value < 0) throw new RangeError(`${key} must be non-negative`);
      latency[key] = { status: 'observed', seconds: value };
    }
  }

  const classification = violations.length ? 'contradicted' : 'consistent';
  const packet = {
    schemaVersion: 1,
    sourceStatus: 'runtime_observation',
    classification,
    samples: normalized,
    intervals,
    latency,
    thresholds: { maxDriftMs, futureToleranceMs },
    violations,
    claimBoundary: 'Clock consistency supports render-timeline interpretation; it does not prove route binding or physical audibility.'
  };
  return { ...packet, evidenceDigest: digest(packet) };
}
