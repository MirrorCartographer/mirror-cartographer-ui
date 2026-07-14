import test from 'node:test';
import assert from 'node:assert/strict';
import { createCurrentStageReceipt } from './current-stage-receipt.mjs';

const BASE = Object.freeze({
  observed_at: '2026-07-14T17:11:02.000Z',
  timezone: 'America/New_York',
});

test('selects the deterministic production for the supplied civil hour', () => {
  const receipt = createCurrentStageReceipt({ ...BASE, hour: 13 });
  assert.equal(receipt.production.id, 'paper-weather');
  assert.equal(receipt.production.renderer, 'paperWeather');
  assert.equal(receipt.guarantees.autoplay, false);
  assert.equal(receipt.guarantees.private_source_material_included, false);
});

test('same inputs produce the same canonical digest', () => {
  const first = createCurrentStageReceipt({ ...BASE, hour: 13 });
  const second = createCurrentStageReceipt({ ...BASE, hour: 13 });
  assert.deepEqual(first, second);
  assert.match(first.sha256, /^[a-f0-9]{64}$/);
});

test('the 24-hour cycle repeats the six-production repertory exactly four times', () => {
  const ids = Array.from({ length: 24 }, (_, hour) => createCurrentStageReceipt({ ...BASE, hour }).production.id);
  assert.deepEqual(ids.slice(0, 6), [
    'coordinate-bloom',
    'paper-weather',
    'signal-garden',
    'night-index',
    'hinge-theatre',
    'soft-machine-room',
  ]);
  for (let offset = 6; offset < 24; offset += 6) {
    assert.deepEqual(ids.slice(offset, offset + 6), ids.slice(0, 6));
  }
});

test('rejects ambiguous or invalid stage observations', () => {
  assert.throws(() => createCurrentStageReceipt({ ...BASE, hour: -1 }), /hour/);
  assert.throws(() => createCurrentStageReceipt({ ...BASE, hour: 24 }), /hour/);
  assert.throws(() => createCurrentStageReceipt({ ...BASE, hour: 13, observed_at: 'invalid' }), /observed_at/);
  assert.throws(() => createCurrentStageReceipt({ ...BASE, hour: 13, timezone: '' }), /timezone/);
});
