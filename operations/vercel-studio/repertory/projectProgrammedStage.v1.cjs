'use strict';

function assertObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
}

function projectProgrammedStage({ repertory, stageCards, utcHour }) {
  assertObject(repertory, 'repertory');
  assertObject(stageCards, 'stageCards');

  if (!Number.isInteger(utcHour) || utcHour < 0 || utcHour > 23) {
    throw new RangeError('utcHour must be an integer from 0 through 23');
  }
  if (repertory.timezone !== 'UTC') {
    throw new Error('repertory timezone must be UTC');
  }
  if (repertory.activation_boundary?.runtime_integration !== 'not_performed') {
    throw new Error('runtime activation boundary is not fail-closed');
  }
  if (stageCards.activation_status !== 'programming_metadata_only') {
    throw new Error('stage cards are not programming metadata only');
  }

  const slot = repertory.hour_slots?.find((candidate) => candidate.utc_hour === utcHour);
  if (!slot) throw new Error(`missing repertory slot for UTC hour ${utcHour}`);

  const production = repertory.productions?.find((candidate) => candidate.id === slot.production_id);
  if (!production) throw new Error(`missing production ${slot.production_id}`);

  const card = stageCards.cards?.find((candidate) => candidate.production_id === slot.production_id);
  if (!card) throw new Error(`missing public stage card ${slot.production_id}`);

  if (production.title !== card.title) {
    throw new Error(`title mismatch for ${slot.production_id}`);
  }

  return Object.freeze({
    schema_version: 1,
    projection_id: `${slot.edition_id}@${String(utcHour).padStart(2, '0')}Z`,
    utc_hour: utcHour,
    edition_id: slot.edition_id,
    edition_cue: slot.edition_cue,
    production_id: production.id,
    title: production.title,
    form: production.form,
    synopsis: card.short_synopsis,
    nonvisual_status: card.nonvisual_status,
    motion_mode: card.motion_mode,
    audio_mode: card.audio_mode,
    mobile_mode: card.mobile_mode,
    privacy_boundary: card.privacy_boundary,
    continuity_role: production.continuity_role,
    continuity_state_preserved: repertory.selection_rule?.continuity_state_preserved_across_productions === true,
    runtime_activation: false,
    evidence_class: 'programming_projection_only'
  });
}

module.exports = { projectProgrammedStage };
