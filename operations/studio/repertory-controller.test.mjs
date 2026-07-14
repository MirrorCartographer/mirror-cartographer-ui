import test from 'node:test';
import assert from 'node:assert/strict';
import { createRepertoryController, createRepertorySchedule } from './repertory-controller.mjs';

const productions = [
  { id: 'quiet-orbit', title: 'Quiet Orbit', renderer: 'orbit', audio_policy: 'user_initiated', motion_policy: 'reducible' },
  { id: 'paper-weather', title: 'Paper Weather', renderer: 'weather', audio_policy: 'silent', motion_policy: 'reducible' },
  { id: 'night-index', title: 'Night Index', renderer: 'index', audio_policy: 'silent', motion_policy: 'essential' },
];
const continuity = { id: 'continuity-public', revision: 'r17' };

function validStage(projection) {
  return {
    staged: true,
    reversible: true,
    production_id: projection.production.id,
    mount_key: projection.mount_key,
    continuity_id: projection.continuity.id,
    continuity_revision: projection.continuity.revision,
    rollback_selector: `[data-mount-key="${projection.mount_key}"]`,
    operation: 'replaceChildren',
    focus_preserved: true,
    content_strategy: 'public_projection_only',
  };
}

test('maps every hour deterministically and repeats by repertory length', () => {
  const schedule = createRepertorySchedule(productions);
  assert.equal(schedule.select(0).production_id, 'quiet-orbit');
  assert.equal(schedule.select(3).production_id, 'quiet-orbit');
  assert.equal(schedule.select(23).production_id, 'night-index');
});

test('stages one production with stable continuity and a reversible receipt', async () => {
  const controller = createRepertoryController({ productions, stage: validStage, continuity });
  const result = await controller.present({ hour: 12, observed_at: '2026-07-14T16:19:23Z' });
  assert.equal(result.receipt.identity.production_id, 'quiet-orbit');
  assert.equal(result.projection.continuity.revision, 'r17');
  assert.equal(result.receipt.rollback.reversible, true);
  assert.equal(result.receipt.runtime.focus_preserved, true);
});

test('reduced motion suppresses reducible motion without changing production identity', async () => {
  const controller = createRepertoryController({ productions, stage: validStage, continuity });
  const result = await controller.present({ hour: 13, observed_at: '2026-07-14T16:19:23Z', reduced_motion: true });
  assert.equal(result.scheduled.production_id, 'paper-weather');
  assert.equal(result.projection.policy.motion_enabled, false);
  assert.equal(result.projection.policy.autoplay, false);
  assert.equal(result.projection.policy.audio_enabled, false);
});

test('fails closed when stage mutates continuity identity', async () => {
  const controller = createRepertoryController({ productions, continuity, stage(projection) { return { ...validStage(projection), continuity_revision: 'r18' }; } });
  await assert.rejects(() => controller.present({ hour: 1, observed_at: '2026-07-14T16:19:23Z' }), /preserve the underlying continuity/);
});

test('fails closed when stage identity diverges from deterministic selection', async () => {
  const controller = createRepertoryController({ productions, continuity, stage(projection) { return { ...validStage(projection), production_id: 'wrong-production' }; } });
  await assert.rejects(() => controller.present({ hour: 2, observed_at: '2026-07-14T16:19:23Z' }), /identities diverged/);
});

test('rejects duplicate production ids', () => {
  assert.throws(() => createRepertorySchedule([productions[0], productions[0]]), /unique/);
});
