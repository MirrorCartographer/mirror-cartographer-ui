'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { buildContinuityHandoff } = require('./buildContinuityHandoff.v1.cjs');

const digest = 'a'.repeat(64);
const commit = 'b'.repeat(40);
const receipt = (hour, id, overrides = {}) => ({ utc_hour: hour, production_id: id, source_commit: commit, repertory_sha256: digest, ...overrides });
const state = { privacy_class: 'public_abstract', companion_signal: 'dim', language_field_phase: 3 };

test('builds deterministic public abstract handoff without activation claims', () => {
  const a = buildContinuityHandoff(receipt(8, 'quiet-machine'), receipt(9, 'wordless-room-game'), state);
  const b = buildContinuityHandoff(receipt(8, 'quiet-machine'), receipt(9, 'wordless-room-game'), { language_field_phase: 3, companion_signal: 'dim', privacy_class: 'public_abstract' });
  assert.equal(a.continuity_state_sha256, b.continuity_state_sha256);
  assert.equal(a.runtime_activation_claimed, false);
  assert.equal(a.deployment_claimed, false);
  assert.deepEqual(a.from, { utc_hour: 8, production_id: 'quiet-machine' });
  assert.deepEqual(a.to, { utc_hour: 9, production_id: 'wordless-room-game' });
});

test('accepts the 23 to 0 daily wrap', () => {
  assert.equal(buildContinuityHandoff(receipt(23, 'archive-afterimage'), receipt(0, 'residual-comet'), state).to.utc_hour, 0);
});

test('fails closed on non-adjacent stages or evidence drift', () => {
  assert.throws(() => buildContinuityHandoff(receipt(8, 'quiet-machine'), receipt(10, 'body-constellation'), state), /not adjacent/);
  assert.throws(() => buildContinuityHandoff(receipt(8, 'quiet-machine'), receipt(9, 'wordless-room-game', { source_commit: 'c'.repeat(40) }), state), /commit mismatch/);
  assert.throws(() => buildContinuityHandoff(receipt(8, 'quiet-machine'), receipt(9, 'wordless-room-game', { repertory_sha256: 'd'.repeat(64) }), state), /digest mismatch/);
});

test('rejects private material at any depth and oversized state', () => {
  assert.throws(() => buildContinuityHandoff(receipt(8, 'a'), receipt(9, 'b'), { ...state, nested: { chat_text: 'private' } }), /forbidden field/);
  assert.throws(() => buildContinuityHandoff(receipt(8, 'a'), receipt(9, 'b'), { ...state, layers: [{ private_source: 'secret' }] }), /forbidden field/);
  assert.throws(() => buildContinuityHandoff(receipt(8, 'a'), receipt(9, 'b'), { privacy_class: 'private' }), /public_abstract/);
  assert.throws(() => buildContinuityHandoff(receipt(8, 'a'), receipt(9, 'b'), { privacy_class: 'public_abstract', payload: 'x'.repeat(5000) }), /4096-byte/);
});

test('rejects circular, non-plain, and unsupported continuity values', () => {
  const circular = { privacy_class: 'public_abstract' };
  circular.self = circular;
  assert.throws(() => buildContinuityHandoff(receipt(8, 'a'), receipt(9, 'b'), circular), /circular reference/);
  assert.throws(() => buildContinuityHandoff(receipt(8, 'a'), receipt(9, 'b'), { ...state, when: new Date() }), /plain object/);
  assert.throws(() => buildContinuityHandoff(receipt(8, 'a'), receipt(9, 'b'), { ...state, callback() {} }), /unsupported value/);
  assert.throws(() => buildContinuityHandoff(receipt(8, 'a'), receipt(9, 'b'), { ...state, score: Infinity }), /non-finite number/);
});

test('retains an immutable deep clone rather than caller-owned nested references', () => {
  const original = { ...state, nested: { phase: 3 }, sequence: [{ signal: 'dim' }] };
  const handoff = buildContinuityHandoff(receipt(8, 'quiet-machine'), receipt(9, 'wordless-room-game'), original);
  original.nested.phase = 99;
  original.sequence[0].signal = 'bright';
  assert.equal(handoff.continuity_state.nested.phase, 3);
  assert.equal(handoff.continuity_state.sequence[0].signal, 'dim');
  assert.equal(Object.isFrozen(handoff.continuity_state.nested), true);
  assert.equal(Object.isFrozen(handoff.continuity_state.sequence[0]), true);
});
