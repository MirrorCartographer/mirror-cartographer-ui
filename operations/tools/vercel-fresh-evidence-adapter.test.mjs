import test from 'node:test';
import assert from 'node:assert/strict';
import { assessFreshReconciledVercelEvidence } from './vercel-fresh-evidence-adapter.mjs';

const commit = 'a'.repeat(40);
const base = {
  target_commit_sha: commit,
  target_commit_time: '2026-07-13T13:00:00Z',
  evaluated_at: '2026-07-13T13:10:00Z',
  reconciliation: { verified: true, target_commit_sha: commit, provider_ceiling_ambiguous: false, reasons: [] },
  primary_observation: { commit_sha: commit, canonical_sha256: '1'.repeat(64), method: 'repository-enumerator', authority: 'github-actions', request_id: 'primary-1', retrieved_at: '2026-07-13T13:05:00Z' },
  independent_observation: { commit_sha: commit, canonical_sha256: '2'.repeat(64), method: 'gh-api-paginate-slurp', authority: 'github-actions', request_id: 'independent-1', retrieved_at: '2026-07-13T13:06:00Z' }
};

test('accepts only verified, exact-commit, fresh reconciled observations', () => {
  const result = assessFreshReconciledVercelEvidence(base);
  assert.equal(result.accepted, true);
  assert.equal(result.deployment_claim_permitted, false);
  assert.equal(result.next_gate, 'commit-bound workflow outcome assessment');
});

test('fails before freshness evaluation when reconciliation is unverified', () => {
  const result = assessFreshReconciledVercelEvidence({ ...base, reconciliation: { ...base.reconciliation, verified: false } });
  assert.equal(result.accepted, false);
  assert.deepEqual(result.reasons, ['reconciliation_not_verified']);
  assert.equal(result.freshness, null);
});

test('rejects provider ceiling ambiguity', () => {
  const result = assessFreshReconciledVercelEvidence({ ...base, reconciliation: { ...base.reconciliation, provider_ceiling_ambiguous: true } });
  assert.equal(result.accepted, false);
  assert.ok(result.reasons.includes('provider_ceiling_ambiguous'));
});

test('rejects replayed observations after reconciliation', () => {
  const shared = { ...base.primary_observation, canonical_sha256: '3'.repeat(64), request_id: 'same' };
  const result = assessFreshReconciledVercelEvidence({ ...base, primary_observation: shared, independent_observation: { ...shared, method: 'gh-api-paginate-slurp' } });
  assert.equal(result.accepted, false);
  assert.ok(result.reasons.includes('identical_retained_bytes'));
  assert.ok(result.reasons.includes('shared_request_identity'));
});

test('rejects stale observations', () => {
  const result = assessFreshReconciledVercelEvidence({ ...base, evaluated_at: '2026-07-13T14:00:00Z' });
  assert.equal(result.accepted, false);
  assert.ok(result.reasons.includes('primary_stale'));
  assert.ok(result.reasons.includes('independent_stale'));
});
