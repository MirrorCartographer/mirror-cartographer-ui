const SHA40 = /^[0-9a-f]{40}$/;
const DEPLOYMENT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{5,199}$/;
const SESSION_ID = /^[A-Za-z0-9_-]{16,128}$/;
const MAX_CLOCK_SKEW_MS = 250;

export function validateAudioOutputTimeline(input = {}) {
  const commitSha = normalize(input.commit_sha);
  const deploymentId = normalize(input.deployment_id);
  const sessionId = normalize(input.session_id);

  if (!SHA40.test(commitSha)) return fail('invalid_commit_sha');
  if (!DEPLOYMENT_ID.test(deploymentId)) return fail('invalid_deployment_id');
  if (!SESSION_ID.test(sessionId)) return fail('invalid_session_id');
  if (input.audio_context_state !== 'running') return fail('audio_context_not_running');

  const samples = Array.isArray(input.samples) ? input.samples : [];
  if (samples.length < 2) return fail('insufficient_samples');

  let previous = null;
  const normalizedSamples = [];
  for (const sample of samples) {
    const contextTime = finiteNumber(sample?.context_time_s);
    const performanceTime = finiteNumber(sample?.performance_time_ms);
    const currentTime = finiteNumber(sample?.current_time_s);
    const capturedAt = finiteNumber(sample?.captured_at_performance_ms);

    if ([contextTime, performanceTime, currentTime, capturedAt].includes(null)) {
      return fail('invalid_sample');
    }
    if (contextTime === 0 && performanceTime === 0) return fail('rendering_not_started');
    if (contextTime <= 0 || performanceTime <= 0) return fail('invalid_output_timestamp');
    if (currentTime <= contextTime) return fail('invalid_current_time_relation');
    if (Math.abs(capturedAt - performanceTime) > MAX_CLOCK_SKEW_MS) {
      return fail('performance_clock_incoherent');
    }
    if (previous && (contextTime <= previous.contextTime || performanceTime <= previous.performanceTime)) {
      return fail('output_timeline_not_advancing');
    }

    normalizedSamples.push(Object.freeze({
      context_time_s: contextTime,
      performance_time_ms: performanceTime,
      current_time_s: currentTime,
      captured_at_performance_ms: capturedAt
    }));
    previous = { contextTime, performanceTime };
  }

  const outputLatency = finiteNumber(input.output_latency_s);
  if (input.output_latency_s !== undefined && (outputLatency === null || outputLatency < 0)) {
    return fail('invalid_output_latency');
  }

  const finalSample = normalizedSamples.at(-1);
  const estimatedAcousticTimeMs = outputLatency === null
    ? null
    : finalSample.performance_time_ms + outputLatency * 1000;

  return Object.freeze({
    valid: true,
    reason: 'render_timeline_observed',
    classification: 'render_timeline_observed',
    binding: Object.freeze({
      commit_sha: commitSha,
      deployment_id: deploymentId,
      session_id: sessionId
    }),
    sample_count: normalizedSamples.length,
    samples: Object.freeze(normalizedSamples),
    output_latency_s: outputLatency,
    estimated_acoustic_time_ms: estimatedAcousticTimeMs,
    epistemic_limits: Object.freeze([
      'Render progression does not prove that a human heard sound.',
      'Acoustic output time is unavailable when outputLatency is unavailable.',
      'Human audibility requires a separate physical-device attestation.'
    ])
  });
}

function normalize(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function fail(reason) {
  return Object.freeze({ valid: false, reason, classification: null });
}
