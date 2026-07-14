import test from 'node:test';
import assert from 'node:assert/strict';
import { createRepertoryBrowserAdapter } from '../studio/repertory-browser-adapter.mjs';

function createHarness(startAt = '2026-07-14T12:20:18.000Z') {
  let nowMs = Date.parse(startAt);
  let nextTimerId = 1;
  const timers = new Map();
  const listeners = new Map();
  const instructions = [];
  const documentRef = {
    visibilityState: 'visible',
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type, listener) { if (listeners.get(type) === listener) listeners.delete(type); },
  };

  return {
    documentRef,
    instructions,
    now: () => nowMs,
    setTimeoutRef(callback, delay) {
      const id = nextTimerId++;
      timers.set(id, { callback, dueAt: nowMs + delay });
      return id;
    },
    clearTimeoutRef(id) { timers.delete(id); },
    advanceTo(timestamp) {
      nowMs = Date.parse(timestamp);
      const due = [...timers.entries()].filter(([, timer]) => timer.dueAt <= nowMs);
      for (const [id, timer] of due) {
        timers.delete(id);
        timer.callback();
      }
    },
    setVisibility(state) {
      documentRef.visibilityState = state;
      listeners.get('visibilitychange')?.();
    },
    timerCount: () => timers.size,
    listenerCount: () => listeners.size,
  };
}

test('starts on the canonical production and schedules exactly one boundary timer', () => {
  const harness = createHarness();
  const adapter = createRepertoryBrowserAdapter({
    ...harness,
    continuity: { revision: 4, marks: ['kept'] },
    matchMediaRef: () => ({ matches: false }),
    onInstruction: (instruction) => harness.instructions.push(instruction),
  });

  const first = adapter.start();
  assert.equal(first.action, 'schedule_transition');
  assert.equal(first.transition.activation_at, '2026-07-14T13:00:00.000Z');
  assert.equal(first.continuity.revision, 4);
  assert.deepEqual(first.continuity.marks, ['kept']);
  assert.equal(harness.timerCount(), 1);
  assert.equal(harness.listenerCount(), 1);
  assert.equal(adapter.snapshot().media.autoplay, false);
});

test('hidden documents cancel timers and visible wakeups resync without replay', () => {
  const harness = createHarness();
  const adapter = createRepertoryBrowserAdapter({
    ...harness,
    matchMediaRef: () => ({ matches: false }),
    onInstruction: (instruction) => harness.instructions.push(instruction),
  });

  adapter.start();
  harness.setVisibility('hidden');
  assert.equal(harness.instructions.at(-1).action, 'suspend_timer');
  assert.equal(harness.timerCount(), 0);

  harness.advanceTo('2026-07-14T15:07:00.000Z');
  harness.setVisibility('visible');
  const wake = harness.instructions.at(-1);
  assert.equal(wake.action, 'resync_now');
  assert.equal(wake.replay_intermediate_productions, false);
  assert.equal(wake.production.hour_key, Math.floor(Date.parse('2026-07-14T15:07:00.000Z') / 3_600_000));
  assert.equal(harness.timerCount(), 1);
});

test('reduced-motion preference reaches the transition contract and stop is reversible', () => {
  const harness = createHarness('2026-07-14T12:59:59.500Z');
  const adapter = createRepertoryBrowserAdapter({
    ...harness,
    matchMediaRef: () => ({ matches: true }),
    onInstruction: (instruction) => harness.instructions.push(instruction),
  });

  const first = adapter.start();
  assert.equal(first.transition.motion.strategy, 'instant');
  assert.equal(first.transition.motion.duration_ms, 0);
  assert.equal(first.media.audio_start_requires_user_gesture, true);
  assert.equal(adapter.stop(), true);
  assert.equal(adapter.snapshot().running, false);
  assert.equal(adapter.snapshot().timer_active, false);
  assert.equal(harness.listenerCount(), 0);
  assert.equal(adapter.stop(), false);
});

test('continuity updates preserve the single shared state across productions', () => {
  const harness = createHarness();
  const adapter = createRepertoryBrowserAdapter({
    ...harness,
    onInstruction: (instruction) => harness.instructions.push(instruction),
  });

  adapter.start();
  adapter.updateContinuity({ version: 1, revision: 12, mode: 'listening', marks: ['north', 'return'] });
  const updated = harness.instructions.at(-1);
  assert.equal(updated.continuity.revision, 12);
  assert.deepEqual(updated.continuity.marks, ['north', 'return']);
  assert.deepEqual(adapter.snapshot().continuity, updated.continuity);
  assert.equal(harness.timerCount(), 1);
});
