'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { projectProgrammedStage } = require('./projectProgrammedStage.v1.cjs');

function fixtures() {
  return {
    repertory: {
      timezone: 'UTC',
      selection_rule: { continuity_state_preserved_across_productions: true },
      activation_boundary: { runtime_integration: 'not_performed' },
      productions: [{ id: 'quiet-machine', title: 'Quiet Machine', form: 'minimal_instrument_panel', continuity_role: 'system_visibility' }],
      hour_slots: [{ utc_hour: 14, edition_id: 'quiet-machine-14', production_id: 'quiet-machine', edition_cue: 'visible-idle' }]
    },
    stageCards: {
      activation_status: 'programming_metadata_only',
      cards: [{ production_id: 'quiet-machine', title: 'Quiet Machine', short_synopsis: 'A restrained instrument reveals poetic state changes without exposing operations.', nonvisual_status: 'State transitions are available as concise text status updates.', motion_mode: 'reduced_motion_equivalent_required', audio_mode: 'silent_by_default_user_gesture_only', mobile_mode: 'touch_safe_single_viewport', privacy_boundary: 'no_worker_controls_or_private_evidence' }]
    }
  };
}

test('projects one deterministic public-safe stage without activation', () => {
  const input = fixtures();
  const result = projectProgrammedStage({ ...input, utcHour: 14 });
  assert.equal(result.edition_id, 'quiet-machine-14');
  assert.equal(result.runtime_activation, false);
  assert.equal(result.evidence_class, 'programming_projection_only');
  assert.equal(result.nonvisual_status, 'State transitions are available as concise text status updates.');
});

test('fails closed when runtime activation is no longer explicitly absent', () => {
  const input = fixtures();
  input.repertory.activation_boundary.runtime_integration = 'performed';
  assert.throws(() => projectProgrammedStage({ ...input, utcHour: 14 }), /fail-closed/);
});

test('fails closed when stage cards are treated as active runtime content', () => {
  const input = fixtures();
  input.stageCards.activation_status = 'active';
  assert.throws(() => projectProgrammedStage({ ...input, utcHour: 14 }), /programming metadata only/);
});

test('fails closed on card and repertory title drift', () => {
  const input = fixtures();
  input.stageCards.cards[0].title = 'Different Title';
  assert.throws(() => projectProgrammedStage({ ...input, utcHour: 14 }), /title mismatch/);
});

test('rejects invalid UTC hours', () => {
  const input = fixtures();
  assert.throws(() => projectProgrammedStage({ ...input, utcHour: 24 }), /0 through 23/);
});
