'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const repertory = require('./HOURLY_REPERTORY.v1.json');
const { verifyRepertorySafetyContract } = require('./verifyRepertorySafetyContract.v1.cjs');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('verifies the committed operations-only repertory safety contract', () => {
  const result = verifyRepertorySafetyContract(repertory);
  assert.equal(result.verified, true);
  assert.equal(result.deterministic, true);
  assert.equal(result.current_stage_id, 'wordless-room-game');
  assert.equal(result.privacy_boundary_preserved, true);
  assert.equal(result.commerce_absent, true);
  assert.equal(result.autoplay_absent, true);
  assert.equal(result.runtime_integration_performed, false);
  assert.equal(result.side_effects_performed, false);
});

test('fails closed when autoplay replaces explicit user gesture audio', () => {
  const candidate = clone(repertory);
  candidate.global_runtime_constraints.audio = 'autoplay';
  assert.throws(
    () => verifyRepertorySafetyContract(candidate),
    /audio must equal explicit_user_gesture_only/,
  );
});

test('fails closed when commerce or conversion logic is introduced', () => {
  const candidate = clone(repertory);
  candidate.global_runtime_constraints.commerce = 'conversion_enabled';
  assert.throws(
    () => verifyRepertorySafetyContract(candidate),
    /commerce must equal no_payments_or_conversion_logic/,
  );
});

test('fails closed when reduced-motion or mobile safety contracts drift', () => {
  const motionCandidate = clone(repertory);
  motionCandidate.global_runtime_constraints.motion = 'always_animate';
  assert.throws(
    () => verifyRepertorySafetyContract(motionCandidate),
    /motion must equal honor_prefers_reduced_motion/,
  );

  const mobileCandidate = clone(repertory);
  mobileCandidate.global_runtime_constraints.mobile = 'desktop_only';
  assert.throws(
    () => verifyRepertorySafetyContract(mobileCandidate),
    /mobile must equal viewport_safe_and_touch_safe/,
  );
});

test('fails closed when provenance classes are incomplete', () => {
  const candidate = clone(repertory);
  candidate.productions[0].provenance.current_decision = '';
  assert.throws(
    () => verifyRepertorySafetyContract(candidate),
    /current_decision must be a non-empty string/,
  );
});

test('fails closed when current-stage evidence is absent or ambiguous', () => {
  const absentEvidence = clone(repertory);
  const current = absentEvidence.productions.find((item) => item.status === 'observed_current_stage');
  current.provenance.observed = [];
  assert.throws(
    () => verifyRepertorySafetyContract(absentEvidence),
    /cannot be observed_current_stage without observed sources/,
  );

  const ambiguous = clone(repertory);
  ambiguous.productions[0].status = 'observed_current_stage';
  assert.throws(
    () => verifyRepertorySafetyContract(ambiguous),
    /exactly one production must be the observed_current_stage/,
  );
});

test('fails closed when operations-only activation boundary is removed', () => {
  const candidate = clone(repertory);
  candidate.activation_boundary.runtime_integration = 'performed';
  assert.throws(
    () => verifyRepertorySafetyContract(candidate),
    /runtime integration must remain not_performed/,
  );
});
