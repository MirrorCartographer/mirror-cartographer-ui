import test from 'node:test';
import assert from 'node:assert/strict';
import { sequenceVercelAcceptance, STATES } from './vercel-release-sequencer.mjs';

test('unknown capacity stays operations-only', () => {
  assert.equal(sequenceVercelAcceptance({}).next_action, STATES.WAIT);
});

test('rate-limited capacity stays operations-only', () => {
  const result = sequenceVercelAcceptance({ provider_capacity: 'rate_limited' });
  assert.equal(result.next_action, STATES.WAIT);
  assert.equal(result.consumes_provider_build, false);
});

test('available capacity requires sentinel first', () => {
  assert.equal(sequenceVercelAcceptance({ provider_capacity: 'available' }).next_action, STATES.SENTINEL);
});

test('sentinel pass advances to exact-commit audio evidence', () => {
  const result = sequenceVercelAcceptance({ provider_capacity: 'available', operations_only_sentinel_skipped: true });
  assert.equal(result.next_action, STATES.AUDIO);
});

test('audio pass advances to immutable deployment binding', () => {
  const result = sequenceVercelAcceptance({ provider_capacity: 'available', operations_only_sentinel_skipped: true, exact_commit_audio_artifact_passed: true });
  assert.equal(result.next_action, STATES.DEPLOY);
});

test('deployment binding advances to physical iPhone Safari', () => {
  const result = sequenceVercelAcceptance({ provider_capacity: 'available', operations_only_sentinel_skipped: true, exact_commit_audio_artifact_passed: true, immutable_deployment_bound: true });
  assert.equal(result.next_action, STATES.DEVICE);
  assert.equal(result.consumes_provider_build, false);
});

test('all evidence completes V-001 acceptance', () => {
  const result = sequenceVercelAcceptance({ provider_capacity: 'available', operations_only_sentinel_skipped: 'observed_pass', exact_commit_audio_artifact_passed: 'observed_pass', immutable_deployment_bound: 'observed_pass', physical_iphone_safari_audible: 'observed_pass' });
  assert.equal(result.next_action, STATES.COMPLETE);
  assert.equal(result.fail_closed, false);
});
