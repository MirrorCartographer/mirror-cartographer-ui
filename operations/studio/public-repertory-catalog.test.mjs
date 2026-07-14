import test from 'node:test';
import assert from 'node:assert/strict';
import { getControllerProductions, getProductionForHour, getPublicRepertoryCatalog } from './public-repertory-catalog.mjs';

const catalog = getPublicRepertoryCatalog();

test('publishes six distinct productions with deterministic hourly rotation', () => {
  assert.equal(catalog.length, 6);
  assert.equal(new Set(catalog.map(({ id }) => id)).size, 6);
  assert.equal(getProductionForHour(0).id, 'coordinate-bloom');
  assert.equal(getProductionForHour(6).id, 'coordinate-bloom');
  assert.equal(getProductionForHour(23).id, 'soft-machine-room');
});

test('projects only the controller contract while retaining provenance in the catalog', () => {
  const projected = getControllerProductions();
  assert.deepEqual(Object.keys(projected[0]), ['id', 'title', 'renderer', 'audio_policy', 'motion_policy']);
  assert.ok(catalog.every(({ provenance }) => provenance.length >= 2));
});

test('marks every provenance claim public-safe and uses explicit epistemic classes', () => {
  const allowed = new Set(['observed_preference', 'inference', 'experiment', 'current_decision']);
  for (const production of catalog) {
    for (const claim of production.provenance) {
      assert.equal(claim.public_safe, true);
      assert.equal(allowed.has(claim.class), true);
    }
  }
});

test('enforces non-autoplay policy and reducible motion by default', () => {
  assert.ok(catalog.every(({ audio_policy }) => audio_policy === 'silent' || audio_policy === 'user_initiated'));
  assert.ok(catalog.filter(({ motion_policy }) => motion_policy === 'essential').length <= 1);
});

test('contains no payment, account, diagnosis, or private-source surface', () => {
  const serialized = JSON.stringify(catalog).toLowerCase();
  for (const forbidden of ['checkout', 'subscribe', 'payment', 'diagnosis', 'patient', 'email address', 'account login']) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});
