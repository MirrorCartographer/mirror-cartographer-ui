import assert from 'node:assert/strict';
import test from 'node:test';

import { createRepertoryTransitionPlan } from '../studio/repertory-transition-contract.mjs';

test('transition activates at the exact next UTC hour and advances production', () => {
  const plan = createRepertoryTransitionPlan({ at: '2026-07-14T12:16:18.000Z' });
  assert.equal(plan.activation_at, '2026-07-14T13:00:00.000Z');
  assert.notEqual(plan.current.id, plan.next.id);
  assert.equal(plan.next.repertory_index, (plan.current.repertory_index + 1) % 4);
});

test('continuity is normalized once and preserved across the boundary', () => {
  const plan = createRepertoryTransitionPlan({
    at: '2026-07-14T12:16:18.000Z',
    continuity: { version: 1, revision: 9, mode: 'listening', marks: ['north', ' return ', 4] },
  });
  assert.deepEqual(plan.continuity, {
    version: 1,
    revision: 9,
    mode: 'listening',
    marks: ['north', 'return'],
  });
  assert.equal(plan.current.continuity_channel, plan.next.continuity_channel);
});

test('reduced-motion preference removes animated transition', () => {
  const plan = createRepertoryTransitionPlan({
    at: '2026-07-14T12:16:18.000Z',
    prefersReducedMotion: true,
  });
  assert.deepEqual(plan.motion, { strategy: 'instant', duration_ms: 0 });
});

test('visible and hidden documents receive deterministic scheduling policy', () => {
  const visible = createRepertoryTransitionPlan({ at: '2026-07-14T12:16:18.000Z' });
  const hidden = createRepertoryTransitionPlan({
    at: '2026-07-14T12:16:18.000Z',
    documentVisible: false,
  });
  assert.equal(visible.scheduling.hidden_document_behavior, 'schedule_boundary');
  assert.equal(hidden.scheduling.hidden_document_behavior, 'resync_on_visibility');
  assert.equal(
    hidden.scheduling.missed_boundary_behavior,
    'select_current_hour_without_replaying_intermediate_productions',
  );
});

test('public transition contract prohibits autoplay, payments, and private material', () => {
  const plan = createRepertoryTransitionPlan({ at: '2026-07-14T12:16:18.000Z' });
  assert.equal(plan.media.autoplay, false);
  assert.equal(plan.media.audio_start_requires_user_gesture, true);
  assert.equal(plan.commerce.payment_logic, false);
  assert.equal(plan.privacy.private_source_material, false);
  assert.equal(plan.accessibility.preserve_focus, true);
  assert.equal(plan.accessibility.aria_live, 'polite');
  assert.equal(plan.rollback.reversible, true);
});

test('invalid environment capability inputs fail closed', () => {
  assert.throws(
    () => createRepertoryTransitionPlan({ prefersReducedMotion: 'yes' }),
    /must be boolean/,
  );
  assert.throws(
    () => createRepertoryTransitionPlan({ documentVisible: null }),
    /must be boolean/,
  );
});
