import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCapacityObservation } from './vercel-capacity-observation.mjs';

const now = '2026-07-12T10:24:00.000Z';

test('accepts a fresh available provider observation', () => {
  const result = validateCapacityObservation({
    observed_at: '2026-07-12T10:20:00.000Z',
    source: 'vercel_api',
    outcome: 'available',
    commit_sha: 'a'.repeat(40)
  }, { now });
  assert.equal(result.valid, true);
  assert.equal(result.provider_capacity, 'available');
});

test('rejects a stale available observation', () => {
  const result = validateCapacityObservation({
    observed_at: '2026-07-12T10:00:00.000Z',
    source: 'vercel_api',
    outcome: 'available'
  }, { now });
  assert.deepEqual(result, {
    schema_version: 1,
    valid: false,
    reason: 'observation_stale',
    provider_capacity: 'unknown',
    fail_closed: true
  });
});

test('rejects rate-limited evidence', () => {
  const result = validateCapacityObservation({
    observed_at: '2026-07-12T10:23:00.000Z',
    source: 'vercel_deployment_attempt',
    outcome: 'rate_limited'
  }, { now });
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'provider_rate_limited');
});

test('rejects unsupported sources', () => {
  const result = validateCapacityObservation({
    observed_at: '2026-07-12T10:23:00.000Z',
    source: 'chat_claim',
    outcome: 'available'
  }, { now });
  assert.equal(result.reason, 'unsupported_observation_source');
});

test('rejects observations from the future', () => {
  const result = validateCapacityObservation({
    observed_at: '2026-07-12T10:25:00.000Z',
    source: 'vercel_dashboard',
    outcome: 'available'
  }, { now });
  assert.equal(result.reason, 'observation_from_future');
});

test('does not retain extra provider payload fields', () => {
  const result = validateCapacityObservation({
    observed_at: '2026-07-12T10:23:00.000Z',
    source: 'vercel_api',
    outcome: 'available',
    token: 'secret',
    url: 'https://example.invalid/private'
  }, { now });
  assert.equal('token' in result, false);
  assert.equal('url' in result, false);
});
