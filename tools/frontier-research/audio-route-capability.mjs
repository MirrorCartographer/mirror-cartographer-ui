const ROUTE_CLASSES = new Set([
  'bound_non_default',
  'default_only',
  'unsupported',
  'unobservable',
  'rejected'
]);

function boolOrNull(value, name) {
  if (value === true || value === false || value === null) return value;
  throw new TypeError(`${name} must be true, false, or null`);
}

function textOrNull(value, name) {
  if (value === null) return null;
  if (typeof value === 'string' && value.trim()) return value;
  throw new TypeError(`${name} must be a non-empty string or null`);
}

export function evaluateAudioRouteCapability(input) {
  if (!input || typeof input !== 'object') throw new TypeError('input must be an object');

  const secureContext = boolOrNull(input.secureContext, 'secureContext');
  const setSinkIdSupported = boolOrNull(input.setSinkIdSupported, 'setSinkIdSupported');
  const selectAudioOutputSupported = boolOrNull(input.selectAudioOutputSupported, 'selectAudioOutputSupported');
  const speakerSelectionAllowed = boolOrNull(input.speakerSelectionAllowed, 'speakerSelectionAllowed');
  const transientActivationObserved = boolOrNull(input.transientActivationObserved, 'transientActivationObserved');
  const requestedSinkId = textOrNull(input.requestedSinkId, 'requestedSinkId');
  const observedSinkId = textOrNull(input.observedSinkId, 'observedSinkId');
  const setSinkIdOutcome = textOrNull(input.setSinkIdOutcome, 'setSinkIdOutcome');
  const selectedDeviceExposed = boolOrNull(input.selectedDeviceExposed, 'selectedDeviceExposed');
  const sinkPresentAfterBind = boolOrNull(input.sinkPresentAfterBind, 'sinkPresentAfterBind');

  const reasons = [];
  let classification = 'unobservable';

  if (secureContext === false) {
    classification = 'unsupported';
    reasons.push('insecure_context');
  } else if (setSinkIdSupported === false) {
    classification = 'unsupported';
    reasons.push('setSinkId_unavailable');
  } else if (speakerSelectionAllowed === false) {
    classification = 'rejected';
    reasons.push('speaker_selection_policy_denied');
  } else if (setSinkIdOutcome === 'NotAllowedError') {
    classification = 'rejected';
    reasons.push('permission_or_policy_denied');
  } else if (setSinkIdOutcome === 'InvalidStateError') {
    classification = 'rejected';
    reasons.push('transient_activation_missing');
  } else if (setSinkIdOutcome === 'NotFoundError') {
    classification = 'rejected';
    reasons.push('requested_sink_not_found');
  } else if (setSinkIdOutcome === 'AbortError') {
    classification = 'rejected';
    reasons.push('sink_switch_failed');
  } else if (setSinkIdOutcome && setSinkIdOutcome !== 'resolved') {
    classification = 'rejected';
    reasons.push('unclassified_setSinkId_error');
  } else if (requestedSinkId === null || requestedSinkId === '') {
    classification = 'default_only';
    reasons.push('default_route_requested');
  } else if (setSinkIdOutcome === 'resolved' && observedSinkId === requestedSinkId) {
    classification = sinkPresentAfterBind === false ? 'rejected' : 'bound_non_default';
    reasons.push(sinkPresentAfterBind === false ? 'bound_sink_became_unavailable' : 'requested_sink_observed');
  } else if (setSinkIdOutcome === 'resolved') {
    classification = 'unobservable';
    reasons.push('resolved_without_matching_sink_observation');
  } else {
    reasons.push('insufficient_route_observation');
  }

  const contradictions = [];
  if (classification === 'bound_non_default' && selectedDeviceExposed === false) {
    contradictions.push('bound_sink_not_exposed_by_device_enumeration');
  }
  if (setSinkIdOutcome === 'resolved' && transientActivationObserved === false) {
    contradictions.push('resolved_without_observed_transient_activation');
  }
  if (classification === 'bound_non_default' && speakerSelectionAllowed === false) {
    contradictions.push('bound_despite_policy_denial');
  }

  if (contradictions.length) classification = 'rejected';
  if (!ROUTE_CLASSES.has(classification)) throw new Error('internal classification error');

  return {
    schemaVersion: 1,
    classification,
    reasons,
    contradictions,
    observations: {
      secureContext,
      setSinkIdSupported,
      selectAudioOutputSupported,
      speakerSelectionAllowed,
      transientActivationObserved,
      requestedSinkId,
      observedSinkId,
      setSinkIdOutcome,
      selectedDeviceExposed,
      sinkPresentAfterBind
    },
    claimBoundary: {
      provesRouteApiObservation: classification === 'bound_non_default',
      provesPhysicalAudibility: false,
      note: 'A matching sinkId observation is evidence of browser route binding, not proof that the device produced audible sound.'
    }
  };
}
