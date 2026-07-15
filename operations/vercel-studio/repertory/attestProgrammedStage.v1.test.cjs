'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { attestProgrammedStage } = require('./attestProgrammedStage.v1.cjs');

function fixtures() {
  const projection = {
    projection_id: 'quiet-machine-14@14Z',
    utc_hour: 14,
    edition_id: 'quiet-machine-14',
    production_id: 'quiet-machine',
    title: 'Quiet Machine',
    synopsis: 'A restrained instrument reveals poetic state changes without exposing operations.',
    privacy_boundary: 'no_worker_controls_or_private_evidence',
    runtime_activation: false,
    evidence_class: 'programming_projection_only'
  };
  const repertory = {
    activation_boundary: { runtime_integration: 'not_performed' },
    productions: [{ id: 'quiet-machine', title: 'Quiet Machine', form: 'minimal_instrument_panel' }],
    hour_slots: [{ utc_hour: 14, edition_id: 'quiet-machine-14', production_id: 'quiet-machine', edition_cue: 'visible-idle' }]
  };
  const stageCards = {
    activation_status: 'programming_metadata_only',
    cards: [{ production_id: 'quiet-machine', title: 'Quiet Machine', short_synopsis: projection.synopsis }]
  };
  return { projection, repertory, stageCards };
}

test('creates a deterministic non-activating attestation', () => {
  const input = fixtures();
  const first = attestProgrammedStage(input);
  const second = attestProgrammedStage({
    stageCards: input.stageCards,
    projection: input.projection,
    repertory: input.repertory
  });
  assert.equal(first.canonical_sha256, second.canonical_sha256);
  assert.match(first.canonical_sha256, /^[a-f0-9]{64}$/);
  assert.equal(first.runtime_activation, false);
  assert.equal(first.evidence_class, 'programming_attestation_only');
});

test('detects public-card drift', () => {
  const input = fixtures();
  input.stageCards.cards[0].short_synopsis = 'Changed synopsis';
  assert.throws(() => attestProgrammedStage(input), /canonical public stage card/);
});

test('detects repertory slot drift', () => {
  const input = fixtures();
  input.repertory.hour_slots[0].edition_id = 'changed-edition';
  assert.throws(() => attestProgrammedStage(input), /canonical repertory slot/);
});

test('rejects activation claims', () => {
  const input = fixtures();
  input.projection.runtime_activation = true;
  assert.throws(() => attestProgrammedStage(input), /non-activating/);
});

test('rejects weakened metadata boundary', () => {
  const input = fixtures();
  input.stageCards.activation_status = 'active_runtime_content';
  assert.throws(() => attestProgrammedStage(input), /programming metadata only/);
});

test('digest changes when canonical production metadata changes', () => {
  const input = fixtures();
  const before = attestProgrammedStage(input).canonical_sha256;
  input.repertory.productions[0].form = 'different-form';
  const after = attestProgrammedStage(input).canonical_sha256;
  assert.notEqual(before, after);
});
