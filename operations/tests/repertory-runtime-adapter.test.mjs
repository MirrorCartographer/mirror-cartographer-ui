import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createRepertoryRuntimeFrame,
  nextRepertoryBoundary,
  normalizeContinuityState,
  publicProductionProjection,
} from '../studio/repertory-runtime-adapter.mjs';

test('runtime frame selects deterministically by canonical UTC hour', () => {
  const at = new Date('2026-07-14T11:03:44.000Z');
  const first = createRepertoryRuntimeFrame({ at });
  const second = createRepertoryRuntimeFrame({ at: new Date('2026-07-14T11:59:59.999Z') });

  assert.equal(first.production.id, second.production.id);
  assert.equal(first.production.hour_key, second.production.hour_key);
  assert.equal(first.selection_basis, 'canonical_utc_hour');
});

test('the next UTC hour advances to a distinct repertory production', () => {
  const current = createRepertoryRuntimeFrame({ at: '2026-07-14T11:03:44.000Z' });
  const next = createRepertoryRuntimeFrame({ at: '2026-07-14T12:00:00.000Z' });

  assert.notEqual(current.production.id, next.production.id);
  assert.equal(next.production.repertory_index, (current.production.repertory_index + 1) % 4);
});

test('one normalized continuity state survives production changes', () => {
  const continuity = { version: 1, revision: 7, mode: 'listening', marks: ['north', ' return ', '', 42] };
  const current = createRepertoryRuntimeFrame({ at: '2026-07-14T11:03:44.000Z', continuity });
  const next = createRepertoryRuntimeFrame({ at: '2026-07-14T12:03:44.000Z', continuity });

  assert.deepEqual(current.continuity, next.continuity);
  assert.deepEqual(current.continuity.marks, ['north', 'return']);
  assert.equal(current.continuity.revision, 7);
});

test('public projection excludes provenance and capabilities internals', () => {
  const frame = createRepertoryRuntimeFrame({ at: '2026-07-14T11:03:44.000Z' });

  assert.equal('provenance' in frame.production, false);
  assert.equal('capabilities' in frame.production, false);
  assert.equal(frame.runtime_contract.private_source_material, false);
  assert.equal(frame.runtime_contract.payment_logic, false);
  assert.equal(frame.runtime_contract.autoplay, false);
});

test('adapter fails closed for unsupported continuity versions', () => {
  assert.throws(
    () => normalizeContinuityState({ version: 2 }),
    /Unsupported continuity state version/,
  );
});

test('public projection fails closed when a required field is missing', () => {
  assert.throws(
    () => publicProductionProjection({ id: 'incomplete' }),
    /missing public field/,
  );
});

test('next boundary is the following exact UTC hour', () => {
  assert.equal(
    nextRepertoryBoundary('2026-07-14T11:03:44.900Z').toISOString(),
    '2026-07-14T12:00:00.000Z',
  );
});
