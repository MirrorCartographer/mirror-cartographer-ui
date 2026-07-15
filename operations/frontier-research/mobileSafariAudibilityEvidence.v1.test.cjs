'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { assessMobileSafariAudibilityEvidence, digest } = require('./mobileSafariAudibilityEvidence.v1.cjs');

const valid = {
  tested_commit: 'a'.repeat(40),
  deployment_id: 'dpl_example',
  deployment_hostname: 'example.vercel.app',
  platform: 'ios_safari_physical_device',
  device_model: 'iPhone',
  os_version: 'iOS verified at test time',
  safari_version: 'Safari verified at test time',
  tester_id: 'human-observer',
  observed_at: '2026-07-15T08:00:00Z',
  user_gesture: true,
  context_state_after_gesture: 'running',
  source_started: true,
  destination_connected: true,
  volume_nonzero: true,
  hardware_mute_checked: true,
  output_route_checked: true,
  human_audibility_observation: true,
  outcome: 'audible_confirmed'
};

test('accepts only complete physical-device audible evidence', () => {
  const result = assessMobileSafariAudibilityEvidence(valid);
  assert.equal(result.verified, true);
  assert.equal(result.reasons.length, 0);
});

test('fails closed when user activation or running context is absent', () => {
  const result = assessMobileSafariAudibilityEvidence({...valid, user_gesture: false, context_state_after_gesture: 'suspended'});
  assert.equal(result.verified, false);
  assert.ok(result.reasons.includes('missing_direct_user_gesture'));
  assert.ok(result.reasons.includes('audio_context_not_running'));
});

test('route activity cannot substitute for human audibility', () => {
  const result = assessMobileSafariAudibilityEvidence({...valid, human_audibility_observation: false, outcome: 'route_active_unverified'});
  assert.equal(result.verified, false);
  assert.equal(result.claim, 'audibility_unverified');
});

test('canonical digest is stable across key order', () => {
  const reversed = Object.fromEntries(Object.entries(valid).reverse());
  assert.equal(digest(valid), digest(reversed));
});
