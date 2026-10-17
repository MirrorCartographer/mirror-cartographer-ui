import test from 'node:test';
import assert from 'node:assert/strict';
import { brierScore, meanBrierScore, probabilityFromCounts, drawOutcome } from '../public/forecast-loom-core.mjs';

test('certain correct forecasts score zero', () => { assert.equal(brierScore(1, 1), 0); assert.equal(brierScore(0, 0), 0); });
test('certain wrong forecasts score one', () => { assert.equal(brierScore(1, 0), 1); assert.equal(brierScore(0, 1), 1); });
test('half-probability forecasts score one quarter', () => { assert.equal(brierScore(0.5, 0), 0.25); assert.equal(brierScore(0.5, 1), 0.25); });
test('mean score averages squared errors within floating-point tolerance', () => { assert.ok(Math.abs(meanBrierScore([{probability:0.8,outcome:1},{probability:0.2,outcome:0}]) - 0.04) < 1e-12); });
test('counts produce base rates', () => { assert.equal(probabilityFromCounts(1, 4), 0.25); assert.equal(probabilityFromCounts(3, 5), 0.6); });
test('injected random source makes simulated draws reproducible', () => { assert.equal(drawOutcome(0.25, () => 0.1), 1); assert.equal(drawOutcome(0.25, () => 0.9), 0); });
test('invalid probabilities and outcomes are rejected', () => { assert.throws(() => brierScore(-0.1, 0), RangeError); assert.throws(() => brierScore(0.5, 2), RangeError); assert.throws(() => meanBrierScore([]), RangeError); });
