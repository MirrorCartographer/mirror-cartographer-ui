import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateAudioRouteCapability } from './audio-route-capability.mjs';

const base = {
  secureContext: true,
  setSinkIdSupported: true,
  selectAudioOutputSupported: true,
  speakerSelectionAllowed: true,
  transientActivationObserved: true,
  requestedSinkId: 'speaker-7',
  observedSinkId: 'speaker-7',
  setSinkIdOutcome: 'resolved',
  selectedDeviceExposed: true,
  sinkPresentAfterBind: true
};

test('classifies observed matching non-default sink as bound', () => {
  const result = evaluateAudioRouteCapability(base);
  assert.equal(result.classification, 'bound_non_default');
  assert.equal(result.claimBoundary.provesPhysicalAudibility, false);
});

test('fails closed when permissions policy denies speaker selection', () => {
  const result = evaluateAudioRouteCapability({ ...base, speakerSelectionAllowed: false, setSinkIdOutcome: 'NotAllowedError' });
  assert.equal(result.classification, 'rejected');
  assert(result.reasons.includes('speaker_selection_policy_denied'));
});

test('distinguishes unsupported API from denied route', () => {
  const result = evaluateAudioRouteCapability({ ...base, setSinkIdSupported: false, setSinkIdOutcome: null });
  assert.equal(result.classification, 'unsupported');
});

test('rejects a sink that disappears after binding', () => {
  const result = evaluateAudioRouteCapability({ ...base, sinkPresentAfterBind: false });
  assert.equal(result.classification, 'rejected');
  assert(result.reasons.includes('bound_sink_became_unavailable'));
});

test('does not infer binding from a resolved promise without matching sinkId', () => {
  const result = evaluateAudioRouteCapability({ ...base, observedSinkId: 'speaker-other' });
  assert.equal(result.classification, 'unobservable');
});

test('detects contradictory exposure evidence', () => {
  const result = evaluateAudioRouteCapability({ ...base, selectedDeviceExposed: false });
  assert.equal(result.classification, 'rejected');
  assert(result.contradictions.includes('bound_sink_not_exposed_by_device_enumeration'));
});
