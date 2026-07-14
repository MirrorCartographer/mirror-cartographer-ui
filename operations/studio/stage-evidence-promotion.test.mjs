import assert from 'node:assert/strict';
import test from 'node:test';
import { createPromotableStageEvidence } from './stage-evidence-promotion.mjs';

test('derives New York civil hour and promotes matching repertory receipt', () => {
  const result = createPromotableStageEvidence({ observed_at: '2026-07-14T17:18:43Z', timezone: 'America/New_York' });
  assert.equal(result.promotable, true);
  assert.equal(result.receipt.civil_hour, 13);
  assert.equal(result.receipt.production.id, 'paper-weather');
  assert.equal(result.coherence.verified, true);
});

test('handles winter standard time deterministically', () => {
  const result = createPromotableStageEvidence({ observed_at: '2026-01-14T18:18:43Z', timezone: 'America/New_York' });
  assert.equal(result.receipt.civil_hour, 13);
  assert.equal(result.receipt.production.id, 'paper-weather');
});

test('rejects unsupported timezones before receipt creation', () => {
  assert.throws(() => createPromotableStageEvidence({ observed_at: '2026-07-14T17:18:43Z', timezone: 'Mars/Olympus' }), RangeError);
});

test('rejects invalid observation timestamps before receipt creation', () => {
  assert.throws(() => createPromotableStageEvidence({ observed_at: 'not-a-date', timezone: 'America/New_York' }), TypeError);
});
