import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_REPERTORY, hourKey, selectProduction, verifyProductionContract } from './deterministic-repertory.mjs';

test('same UTC hour selects the same production', () => {
  assert.deepEqual(selectProduction('2026-07-14T19:01:00Z'), selectProduction('2026-07-14T19:59:59Z'));
});

test('hour key changes exactly at the UTC hour boundary', () => {
  assert.equal(hourKey('2026-07-14T19:59:59Z'), '2026-07-14T19');
  assert.equal(hourKey('2026-07-14T20:00:00Z'), '2026-07-14T20');
});

test('every scheduled production passes accessibility and rollback policy', () => {
  for (const production of DEFAULT_REPERTORY) {
    assert.deepEqual(verifyProductionContract(production), { verified: true, failures: [] });
  }
});

test('invalid repertories fail closed', () => {
  assert.throws(() => selectProduction('2026-07-14T19:00:00Z', [{ id: 'only' }]));
  assert.throws(() => selectProduction('2026-07-14T19:00:00Z', [{ id: 'same' }, { id: 'same' }]));
});

test('autoplay is rejected', () => {
  assert.deepEqual(
    verifyProductionContract({ surface: 'creative', motion: 'opt-in', audio: 'autoplay', rollback: 'atlas' }),
    { verified: false, failures: ['audio_autoplay_forbidden'] },
  );
});
