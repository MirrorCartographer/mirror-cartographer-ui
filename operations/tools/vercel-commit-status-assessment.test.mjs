import test from 'node:test';
import assert from 'node:assert/strict';
import { assessVercelCommitStatus } from './vercel-commit-status-assessment.mjs';

const base = {
  repository: 'MirrorCartographer/mirror-cartographer-ui',
  commit_sha: 'a3b095267bfd7ac7e98cfd98ae94de3d34bb44c3',
  observed_at: '2026-07-12T20:15:48Z'
};

test('classifies explicit provider build-rate failure', () => {
  const result = assessVercelCommitStatus({
    ...base,
    statuses: [{ context: 'Vercel', state: 'failure', target_url: 'https://vercel.com/x?upgradeToPro=build-rate-limit' }]
  });
  assert.equal(result.accepted, true);
  assert.equal(result.deployable, false);
  assert.equal(result.decision, 'provider_build_rate_limited');
});

test('does not treat missing Vercel status as success', () => {
  const result = assessVercelCommitStatus({ ...base, statuses: [] });
  assert.equal(result.decision, 'vercel_status_absent');
  assert.equal(result.deployable, false);
});

test('records success without claiming immutable deployment binding', () => {
  const result = assessVercelCommitStatus({
    ...base,
    statuses: [{ context: 'Vercel', state: 'success', target_url: 'https://vercel.com/deployments/abc' }]
  });
  assert.equal(result.decision, 'vercel_status_success_observed');
  assert.equal(result.deployable, true);
  assert.match(result.reason, /separate verification/);
});

test('fails closed on malformed status rows', () => {
  const result = assessVercelCommitStatus({ ...base, statuses: [{ context: 'Vercel' }] });
  assert.deepEqual(result, { accepted: false, decision: 'malformed_status' });
});
