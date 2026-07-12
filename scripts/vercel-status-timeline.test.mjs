import assert from 'node:assert/strict';
import { evaluateStatusTimeline } from './vercel-status-timeline.mjs';

const commit = 'abc123';
const status = (state, observedAt, extra = {}) => ({
  context: 'Vercel',
  state,
  observed_at: observedAt,
  commit_sha: commit,
  ...extra
});

assert.equal(
  evaluateStatusTimeline([
    status('failure', '2026-07-12T19:00:00Z', {
      target_url: 'https://vercel.com/upgrade?upgradeToPro=build-rate-limit'
    })
  ], commit).decision,
  'hold_for_capacity'
);

assert.equal(
  evaluateStatusTimeline([
    status('failure', '2026-07-12T18:00:00Z'),
    status('pending', '2026-07-12T19:00:00Z')
  ], commit).decision,
  'hold_for_final_status'
);

assert.equal(
  evaluateStatusTimeline([status('success', '2026-07-12T19:00:00Z')], 'different').decision,
  'hold_commit_mismatch'
);

assert.equal(
  evaluateStatusTimeline([
    status('pending', '2026-07-12T19:00:00Z'),
    status('failure', '2026-07-12T19:00:00Z')
  ], commit).decision,
  'hold_conflicting_latest_statuses'
);

assert.equal(
  evaluateStatusTimeline([{ context: 'Vercel', state: 'pending', commit_sha: commit }], commit).decision,
  'hold_invalid_timeline'
);

console.log('5 timeline policy tests passed');
