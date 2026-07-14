import test from 'node:test';
import assert from 'node:assert/strict';
import { createRepertoryStageReceipt } from './repertory-stage-receipt.mjs';

const base = {
  scheduled: { slot_key: 'hour-12', hour: 12, production_id: 'quiet-orbit', deterministic: true },
  projection: { production: { id: 'quiet-orbit' }, mount_key: 'quiet-orbit@12' },
  stage_result: {
    staged: true,
    operation: 'replace',
    production_id: 'quiet-orbit',
    mount_key: 'quiet-orbit@12',
    focus_preserved: true,
    content_strategy: 'structured_text',
    reversible: true,
    rollback_selector: '[data-mirror-repertory-root]',
  },
  observed_at: '2026-07-14T16:14:45Z',
};

test('issues a bounded receipt for an identity-consistent reversible stage', () => {
  const receipt = createRepertoryStageReceipt(base);
  assert.equal(receipt.identity.production_id, 'quiet-orbit');
  assert.equal(receipt.schedule.hour, 12);
  assert.equal(receipt.rollback.reversible, true);
  assert.equal(receipt.claims.deployment_verified, false);
  assert.equal(receipt.privacy.private_source_material, false);
});

test('rejects schedule to projection identity divergence', () => {
  assert.throws(() => createRepertoryStageReceipt({
    ...base,
    scheduled: { ...base.scheduled, production_id: 'wrong-production' },
  }), /identities diverged/);
});

test('rejects projection to staged mount divergence', () => {
  assert.throws(() => createRepertoryStageReceipt({
    ...base,
    stage_result: { ...base.stage_result, mount_key: 'other@12' },
  }), /mount identities diverged/);
});

test('rejects unapplied or non-reversible stage results', () => {
  assert.throws(() => createRepertoryStageReceipt({
    ...base,
    stage_result: { ...base.stage_result, staged: false },
  }), /unapplied transaction/);
  assert.throws(() => createRepertoryStageReceipt({
    ...base,
    stage_result: { ...base.stage_result, reversible: false },
  }), /rollback route/);
});

test('rejects invalid repertory hours', () => {
  assert.throws(() => createRepertoryStageReceipt({
    ...base,
    scheduled: { ...base.scheduled, hour: 24 },
  }), /0 through 23/);
});
