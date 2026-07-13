import assert from 'node:assert/strict';
import test from 'node:test';
import { assessObservationFreshness } from './frontier-observation-freshness-gate.mjs';

const commit = 'a'.repeat(40);
const base = {
  target_commit_sha: commit,
  target_commit_time: '2026-07-13T12:00:00Z',
  evaluated_at: '2026-07-13T12:10:00Z',
  max_observation_age_ms: 15 * 60 * 1000,
  max_channel_skew_ms: 5 * 60 * 1000,
  primary: {
    commit_sha: commit,
    method: 'github-rest-link-pagination',
    authority: 'api.github.com',
    request_id: 'req-primary',
    retrieved_at: '2026-07-13T12:08:00Z',
    canonical_sha256: '1'.repeat(64)
  },
  independent: {
    commit_sha: commit,
    method: 'gh-api-paginate-slurp',
    authority: 'api.github.com',
    request_id: 'req-independent',
    retrieved_at: '2026-07-13T12:09:00Z',
    canonical_sha256: '2'.repeat(64)
  }
};

test('accepts fresh exact-commit observations with distinct request and byte identities', () => {
  const result = assessObservationFreshness(base);
  assert.equal(result.accepted, true);
  assert.equal(result.classification, 'fresh_independent_observations');
  assert.equal(result.workflow_or_deployment_claim_permitted, false);
});

test('rejects an observation captured before the target commit existed', () => {
  const result = assessObservationFreshness({
    ...base,
    primary: { ...base.primary, retrieved_at: '2026-07-13T11:59:59Z' }
  });
  assert.equal(result.accepted, false);
  assert.ok(result.reasons.includes('primary_predates_target_commit'));
});

test('rejects stale retained observations even when their records agree', () => {
  const result = assessObservationFreshness({
    ...base,
    evaluated_at: '2026-07-13T13:00:00Z'
  });
  assert.equal(result.accepted, false);
  assert.ok(result.reasons.includes('primary_stale'));
  assert.ok(result.reasons.includes('independent_stale'));
});

test('rejects shared request identity as possible replay or duplicated capture', () => {
  const result = assessObservationFreshness({
    ...base,
    independent: { ...base.independent, request_id: base.primary.request_id }
  });
  assert.equal(result.accepted, false);
  assert.ok(result.reasons.includes('shared_request_identity'));
});

test('rejects identical retained bytes and excessive channel skew', () => {
  const result = assessObservationFreshness({
    ...base,
    independent: {
      ...base.independent,
      retrieved_at: '2026-07-13T12:01:00Z',
      canonical_sha256: base.primary.canonical_sha256
    }
  });
  assert.equal(result.accepted, false);
  assert.ok(result.reasons.includes('identical_retained_bytes'));
  assert.ok(result.reasons.includes('channel_skew_exceeded'));
});
