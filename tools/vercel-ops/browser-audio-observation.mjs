import { createAudioAttestationSession } from './audio-attestation-capture.mjs';

export function createBrowserAudioObservation(options = {}) {
  const navigatorRef = options.navigatorRef ?? globalThis.navigator;
  const now = typeof options.now === 'function' ? options.now : () => new Date().toISOString();
  const session = createAudioAttestationSession({ now, randomBytes: options.randomBytes });
  let activated = false;
  let runtimeObserved = false;

  return Object.freeze({
    session_id: session.session_id,
    captureActivation() {
      if (!navigatorRef?.userActivation?.isActive) throw new Error('transient_user_activation_required');
      session.recordActivation(now());
      activated = true;
      return this;
    },
    captureRuntime(audioContext, route = {}) {
      if (!activated) throw new Error('activation_required');
      if (!audioContext || typeof audioContext.state !== 'string') throw new Error('audio_context_required');
      session.recordRuntime({
        audio_context_state: audioContext.state,
        source_started: route.source_started === true,
        destination_connected: route.destination_connected === true
      }, now());
      runtimeObserved = true;
      return this;
    },
    captureHumanOutcome(audible) {
      if (!runtimeObserved) throw new Error('runtime_required');
      session.recordHumanOutcome(audible, now());
      return this;
    },
    finalize(identity, verifyOptions = {}) {
      return session.finalize(identity, verifyOptions);
    }
  });
}
