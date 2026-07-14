import assert from 'node:assert/strict';
import test from 'node:test';
import { assessStageTimeCoherence, deriveCivilHour } from './stage-time-coherence.mjs';

test('derives civil hour across daylight-saving-aware IANA zones', () => {
  assert.equal(deriveCivilHour({ observed_at: '2026-07-14T17:14:55Z', timezone: 'America/New_York' }), 13);
  assert.equal(deriveCivilHour({ observed_at: '2026-01-14T17:14:55Z', timezone: 'America/New_York' }), 12);
});

test('accepts a coherent Paper Weather receipt', () => {
  const result = assessStageTimeCoherence({ observed_at: '2026-07-14T17:14:55Z', timezone: 'America/New_York', civil_hour: 13, production: { id: 'paper-weather' } });
  assert.equal(result.verified, true);
  assert.deepEqual(result.reasons, []);
});

test('fails closed when declared civil hour disagrees with timestamp and timezone', () => {
  const result = assessStageTimeCoherence({ observed_at: '2026-07-14T17:14:55Z', timezone: 'America/New_York', civil_hour: 12, production: { id: 'paper-weather' } });
  assert.equal(result.verified, false);
  assert.deepEqual(result.reasons, ['civil_hour_mismatch']);
});

test('fails closed when production does not match the derived hour', () => {
  const result = assessStageTimeCoherence({ observed_at: '2026-07-14T17:14:55Z', timezone: 'America/New_York', civil_hour: 13, production: { id: 'signal-garden' } });
  assert.equal(result.verified, false);
  assert.deepEqual(result.reasons, ['production_mismatch']);
});

test('rejects unsupported time zones and malformed receipts', () => {
  assert.throws(() => deriveCivilHour({ observed_at: '2026-07-14T17:14:55Z', timezone: 'Mars/Olympus' }), /supported IANA/);
  assert.throws(() => assessStageTimeCoherence(null), /receipt must be an object/);
});
