import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAudioOutputRouteEvidence } from './audio-output-route-evidence.mjs';

const base = {
  commit_sha: 'a'.repeat(40),
  deployment_id: 'dpl_immutable_12345',
  session_id: 'session_audio_route_12345',
  route_api_state: 'supported',
  set_sink_id_status: 'fulfilled',
  requested_sink_id: 'speaker-42',
  observed_sink_id: 'speaker-42',
  enumerated_audiooutput_ids: ['default', 'speaker-42'],
  devicechange_observed: false,
  enumerated_audiooutputs: [{ deviceId: 'speaker-42', kind: 'audiooutput', label: '' }]
};

test('accepts a bound non-default route', () => {
  const result = validateAudioOutputRouteEvidence(base);
  assert.equal(result.valid, true);
  assert.equal(result.classification, 'non_default_route_bound');
});

test('classifies user-agent default route without identifying hardware', () => {
  const result = validateAudioOutputRouteEvidence({ ...base, requested_sink_id: '', observed_sink_id: '' });
  assert.equal(result.valid, true);
  assert.equal(result.classification, 'user_agent_default_route_only');
});

test('rejects requested and observed sink mismatch', () => {
  const result = validateAudioOutputRouteEvidence({ ...base, observed_sink_id: 'speaker-99' });
  assert.deepEqual(result, { valid: false, reason: 'requested_observed_sink_mismatch', classification: null });
});

test('rejects selected sink absent from enumerateDevices evidence', () => {
  const result = validateAudioOutputRouteEvidence({ ...base, enumerated_audiooutput_ids: ['default'] });
  assert.equal(result.reason, 'observed_sink_not_enumerated');
});

test('rejects retained device labels', () => {
  const result = validateAudioOutputRouteEvidence({
    ...base,
    enumerated_audiooutputs: [{ deviceId: 'speaker-42', kind: 'audiooutput', label: 'Charity headset' }]
  });
  assert.equal(result.reason, 'unredacted_device_label');
});

test('preserves unsupported API as an explicit valid classification', () => {
  const result = validateAudioOutputRouteEvidence({
    commit_sha: base.commit_sha,
    deployment_id: base.deployment_id,
    session_id: base.session_id,
    route_api_state: 'unsupported'
  });
  assert.equal(result.valid, true);
  assert.equal(result.classification, 'route_api_unsupported');
});

test('preserves a rejected selection without treating it as route proof', () => {
  const result = validateAudioOutputRouteEvidence({
    ...base,
    set_sink_id_status: 'rejected',
    rejection_name: 'NotAllowedError'
  });
  assert.equal(result.valid, true);
  assert.equal(result.classification, 'route_selection_rejected');
});
