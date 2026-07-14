import test from 'node:test';
import assert from 'node:assert/strict';
import { createRepertoryDomProjection } from '../studio/repertory-dom-projection.mjs';

const base = {
  action: 'schedule_transition',
  production: {
    id: 'archive-afterimage', title: 'Archive Afterimage', form: 'film',
    continuity_channel: 'shared_continuity_v1', visual_grammar: 'retained marks, delayed echoes, quiet cuts',
    hour_key: 495565,
  },
  continuity: { version: 1, revision: 7, mode: 'quiet', marks: ['private-mark'] },
  missed_boundary: false,
};

test('projects a public accessible mount model without leaking continuity marks', () => {
  const result = createRepertoryDomProjection(base);
  assert.equal(result.mount_key, '495565:archive-afterimage');
  assert.equal(result.production.title, 'Archive Afterimage');
  assert.equal(result.accessibility.aria_live, 'off');
  assert.equal(result.media.autoplay, false);
  assert.equal(result.commerce.payment_logic, false);
  assert.equal('marks' in result.continuity, false);
  assert.equal(JSON.stringify(result).includes('private-mark'), false);
});

test('announces a missed-boundary resynchronization politely without replay', () => {
  const result = createRepertoryDomProjection({ ...base, action: 'resync_now', missed_boundary: true });
  assert.equal(result.accessibility.aria_live, 'polite');
  assert.equal(result.lifecycle.missed_boundary, true);
  assert.equal(result.lifecycle.replay_intermediate_productions, false);
});

test('represents a hidden-page suspension without enabling media', () => {
  const result = createRepertoryDomProjection({ ...base, action: 'suspend_timer' });
  assert.equal(result.lifecycle.suspended, true);
  assert.equal(result.media.autoplay, false);
  assert.equal(result.media.audio_start_requires_user_gesture, true);
});

test('fails closed for unknown actions, forms, and continuity versions', () => {
  assert.throws(() => createRepertoryDomProjection({ ...base, action: 'play_everything' }), /Unsupported instruction action/);
  assert.throws(() => createRepertoryDomProjection({ ...base, production: { ...base.production, form: 'dashboard' } }), /Unsupported production form/);
  assert.throws(() => createRepertoryDomProjection({ ...base, continuity: { ...base.continuity, version: 2 } }), /version 1/);
});
