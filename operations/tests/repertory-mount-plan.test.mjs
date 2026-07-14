import test from 'node:test';
import assert from 'node:assert/strict';
import { createRepertoryMountPlan } from '../studio/repertory-mount-plan.mjs';

function projection(overrides = {}) {
  return {
    schema_version: 1,
    mount_key: '495566:glass-orbit',
    production: { id: 'glass-orbit', title: 'Glass Orbit', form: 'stage', visual_grammar: 'thin orbital lines and quiet negative space' },
    continuity: { channel: 'shared-state', version: 1, revision: 8, mode: 'quiet' },
    lifecycle: { action: 'schedule_transition', suspended: false, missed_boundary: false, replay_intermediate_productions: false },
    accessibility: { landmark_role: 'region', label: 'Glass Orbit — stage', aria_live: 'off', preserve_focus: true, reduced_motion_safe: true },
    media: { autoplay: false, audio_start_requires_user_gesture: true },
    privacy: { private_source_material: false, raw_continuity_marks_exposed: false },
    commerce: { payment_logic: false, conversion_logic: false },
    ...overrides,
  };
}

test('creates deterministic focus-preserving mount plan', () => {
  const plan = createRepertoryMountPlan(projection());
  assert.equal(plan.operation, 'replace');
  assert.equal(plan.attributes['data-production-id'], 'glass-orbit');
  assert.equal(plan.behavior.preserve_focus, true);
  assert.equal(plan.behavior.focus_target, null);
  assert.equal(plan.behavior.network_requests, false);
  assert.equal(plan.behavior.persistence, false);
});

test('hidden production produces inert suspension without autoplay', () => {
  const plan = createRepertoryMountPlan(projection({ lifecycle: { suspended: true } }));
  assert.equal(plan.operation, 'suspend');
  assert.equal(plan.attributes.inert, true);
  assert.equal(plan.behavior.autoplay, false);
  assert.equal(plan.behavior.audio_start_requires_user_gesture, true);
});

test('rejects privacy, commerce, and media policy regressions', () => {
  assert.throws(() => createRepertoryMountPlan(projection({ media: { autoplay: true, audio_start_requires_user_gesture: false } })), /Unsafe media policy/);
  assert.throws(() => createRepertoryMountPlan(projection({ privacy: { private_source_material: true, raw_continuity_marks_exposed: false } })), /Unsafe privacy policy/);
  assert.throws(() => createRepertoryMountPlan(projection({ commerce: { payment_logic: true, conversion_logic: false } })), /Commerce logic/);
});

test('rejects executable or unsupported mount surfaces', () => {
  assert.throws(() => createRepertoryMountPlan(projection(), { tag: 'script' }), /Unsupported mount tag/);
  assert.throws(() => createRepertoryMountPlan(projection({ schema_version: 2 })), /Unsupported projection schema/);
});
