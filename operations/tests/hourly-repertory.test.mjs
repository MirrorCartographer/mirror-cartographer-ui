import assert from 'node:assert/strict';
import test from 'node:test';

import {
  REPERTORY,
  productionForHour,
  repertoryHourKey,
  validateRepertory,
} from '../studio/hourly-repertory.mjs';

test('repertory entries preserve one continuity channel and required public-surface constraints', () => {
  assert.equal(validateRepertory(REPERTORY), true);
  assert.equal(new Set(REPERTORY.map(({ id }) => id)).size, REPERTORY.length);
  for (const production of REPERTORY) {
    assert.equal(production.continuity_channel, 'shared_continuity_v1');
    assert.deepEqual(production.capabilities, {
      accessible: true,
      mobile_safe: true,
      non_autoplaying: true,
      reversible: true,
    });
    assert.ok(production.provenance.observed.length > 0);
    assert.ok(production.provenance.inferred.length > 0);
    assert.ok(production.provenance.experiment.length > 0);
    assert.ok(production.provenance.current_decision.length > 0);
  }
});

test('the same UTC hour always selects the same production', () => {
  const instant = new Date('2026-07-14T10:15:00.000Z');
  assert.deepEqual(productionForHour(instant), productionForHour(instant.getTime()));
});

test('selection changes exactly at the hour boundary and wraps deterministically', () => {
  const before = productionForHour('2026-07-14T10:59:59.999Z');
  const after = productionForHour('2026-07-14T11:00:00.000Z');
  assert.notEqual(before.id, after.id);
  assert.equal(after.repertory_index, (before.repertory_index + 1) % REPERTORY.length);
});

test('timezone presentation cannot alter the canonical hour key for one instant', () => {
  const utc = new Date('2026-07-14T10:00:00.000Z');
  const offsetEquivalent = new Date('2026-07-14T06:00:00.000-04:00');
  assert.equal(repertoryHourKey(utc), repertoryHourKey(offsetEquivalent));
  assert.equal(productionForHour(utc).id, productionForHour(offsetEquivalent).id);
});

test('invalid dates and empty repertories fail closed', () => {
  assert.throws(() => repertoryHourKey('not-a-date'), TypeError);
  assert.throws(() => productionForHour(Date.now(), []), TypeError);
});
