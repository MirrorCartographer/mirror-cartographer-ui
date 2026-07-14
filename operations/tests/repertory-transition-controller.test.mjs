import test from 'node:test';
import assert from 'node:assert/strict';
import { createRepertoryControllerInstruction } from '../studio/repertory-transition-controller.mjs';

test('schedules the exact next UTC-hour transition while preserving continuity', () => {
  const result = createRepertoryControllerInstruction({
    now: '2026-07-14T12:20:18.000Z',
    continuity: { version: 1, revision: 7, mode: 'listening', marks: ['north'] },
  });
  assert.equal(result.action, 'schedule_transition');
  assert.equal(result.transition.activation_at, '2026-07-14T13:00:00.000Z');
  assert.equal(result.timer_delay_ms, 2_382_000);
  assert.deepEqual(result.continuity, result.transition.continuity);
  assert.equal(result.transition.current.id === result.transition.next.id, false);
});

test('hidden documents suspend timers and do not replay missed productions', () => {
  const result = createRepertoryControllerInstruction({
    now: '2026-07-14T12:20:18.000Z',
    documentVisible: false,
    scheduledActivationAt: '2026-07-14T12:00:00.000Z',
  });
  assert.equal(result.action, 'suspend_timer');
  assert.equal(result.timer_delay_ms, null);
  assert.equal(result.missed_boundary, true);
  assert.equal(result.replay_intermediate_productions, false);
});

test('late visible wakeups resync directly to the canonical current-hour production', () => {
  const result = createRepertoryControllerInstruction({
    now: '2026-07-14T15:07:00.000Z',
    scheduledActivationAt: '2026-07-14T13:00:00.000Z',
    continuity: { revision: 9, marks: ['kept'] },
  });
  assert.equal(result.action, 'resync_now');
  assert.equal(result.production.hour_key, Math.floor(Date.parse('2026-07-14T15:07:00.000Z') / 3_600_000));
  assert.equal(result.timer_delay_ms, 3_180_000);
  assert.equal(result.continuity.revision, 9);
  assert.deepEqual(result.continuity.marks, ['kept']);
  assert.equal(result.replay_intermediate_productions, false);
});

test('reduced-motion scheduling is instant and media remains gesture-gated', () => {
  const result = createRepertoryControllerInstruction({
    now: '2026-07-14T12:59:59.500Z',
    prefersReducedMotion: true,
  });
  assert.equal(result.timer_delay_ms, 500);
  assert.equal(result.transition.motion.strategy, 'instant');
  assert.equal(result.transition.motion.duration_ms, 0);
  assert.equal(result.media.autoplay, false);
  assert.equal(result.media.audio_start_requires_user_gesture, true);
});

test('rejects invalid visibility and stale scheduling inputs', () => {
  assert.throws(() => createRepertoryControllerInstruction({ documentVisible: 'yes' }), /boolean/);
  assert.throws(() => createRepertoryControllerInstruction({ scheduledActivationAt: 'not-a-date' }), /valid date/);
});
