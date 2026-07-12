import { createBrowserAudioObservation } from './browser-audio-observation.mjs';
import { validateAudioOutputTimeline } from '../frontier-research/audio-output-timeline.mjs';

export function createBrowserAudioEvidence(options = {}) {
  const observation = createBrowserAudioObservation(options);
  const samples = [];
  let audioContext = null;

  return Object.freeze({
    session_id: observation.session_id,
    captureActivation() {
      observation.captureActivation();
      return this;
    },
    captureRuntime(context, route = {}) {
      observation.captureRuntime(context, route);
      audioContext = context;
      return this;
    },
    captureOutputSample(performanceRef = globalThis.performance) {
      if (!audioContext) throw new Error('runtime_required');
      if (typeof audioContext.getOutputTimestamp !== 'function') throw new Error('output_timestamp_unsupported');
      const timestamp = audioContext.getOutputTimestamp();
      samples.push(Object.freeze({
        context_time_s: timestamp?.contextTime,
        performance_time_ms: timestamp?.performanceTime,
        current_time_s: audioContext.currentTime,
        captured_at_performance_ms: performanceRef?.now?.()
      }));
      return this;
    },
    captureHumanOutcome(audible) {
      observation.captureHumanOutcome(audible);
      return this;
    },
    finalize(identity, verifyOptions = {}) {
      const attestation = observation.finalize(identity, verifyOptions);
      const renderTimeline = validateAudioOutputTimeline({
        commit_sha: identity?.commit_sha,
        deployment_id: identity?.deployment_id,
        session_id: observation.session_id,
        audio_context_state: audioContext?.state,
        samples,
        ...(typeof audioContext?.outputLatency === 'number'
          ? { output_latency_s: audioContext.outputLatency }
          : {})
      });
      return Object.freeze({
        valid: attestation.valid === true && renderTimeline.valid === true,
        reason: attestation.valid !== true ? attestation.reason : renderTimeline.reason,
        attestation,
        render_timeline: renderTimeline,
        contradiction_preserved: attestation.binding?.classification === 'contradicted'
      });
    }
  });
}
