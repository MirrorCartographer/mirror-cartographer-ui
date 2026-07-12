const STATES = Object.freeze({
  UNSUPPORTED: 'unsupported',
  BLOCKED: 'blocked',
  RUNTIME_ONLY: 'runtime_only',
  SIGNAL_OBSERVED: 'signal_observed',
  HUMAN_CONFIRMED: 'human_confirmed',
  CONTRADICTED: 'contradicted'
});

function bool(value) { return value === true; }

export function classifyAudioAudibilityEvidence(input = {}) {
  const supported = bool(input.audioContextSupported);
  const userActivationObserved = bool(input.userActivationObserved);
  const resumeFulfilled = bool(input.resumeFulfilled);
  const contextRunning = input.contextStateAfter === 'running';
  const sourceStarted = bool(input.sourceStarted);
  const destinationConnected = bool(input.destinationConnected);
  const signalObserved = bool(input.signalObserved);
  const humanReportedAudible = input.humanReportedAudible;

  if (!supported) return result(STATES.UNSUPPORTED, false, 'AudioContext support was not observed.');
  if (humanReportedAudible === false && signalObserved) {
    return result(STATES.CONTRADICTED, false, 'A signal was observed but the bounded human check reported no audible output.');
  }
  if (!userActivationObserved || !resumeFulfilled || !contextRunning) {
    return result(STATES.BLOCKED, false, 'User activation and a fulfilled resume into running state were not all observed.');
  }
  if (!sourceStarted || !destinationConnected) {
    return result(STATES.RUNTIME_ONLY, false, 'The context ran, but source start and destination routing were not both observed.');
  }
  if (humanReportedAudible === true) {
    return result(STATES.HUMAN_CONFIRMED, true, 'A bounded human audibility check confirmed output after runtime prerequisites were observed.');
  }
  if (signalObserved) {
    return result(STATES.SIGNAL_OBSERVED, false, 'Machine-observed signal evidence exists, but human audibility remains unconfirmed.');
  }
  return result(STATES.RUNTIME_ONLY, false, 'Runtime prerequisites were observed, but neither signal evidence nor human audibility was confirmed.');
}

function result(state, supportsAudibilityClaim, reason) {
  return Object.freeze({ state, supportsAudibilityClaim, reason });
}

export { STATES };
