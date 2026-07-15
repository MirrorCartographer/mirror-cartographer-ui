'use strict';

const { createHash } = require('node:crypto');

function assertObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
}

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash('sha256').update(canonicalize(value), 'utf8').digest('hex');
}

function attestProgrammedStage({ projection, repertory, stageCards }) {
  assertObject(projection, 'projection');
  assertObject(repertory, 'repertory');
  assertObject(stageCards, 'stageCards');

  if (projection.runtime_activation !== false) {
    throw new Error('projection must remain non-activating');
  }
  if (projection.evidence_class !== 'programming_projection_only') {
    throw new Error('projection evidence class is not fail-closed');
  }
  if (repertory.activation_boundary?.runtime_integration !== 'not_performed') {
    throw new Error('repertory runtime activation boundary is not fail-closed');
  }
  if (stageCards.activation_status !== 'programming_metadata_only') {
    throw new Error('stage cards must remain programming metadata only');
  }

  const slot = repertory.hour_slots?.find((candidate) => candidate.utc_hour === projection.utc_hour);
  if (!slot || slot.production_id !== projection.production_id || slot.edition_id !== projection.edition_id) {
    throw new Error('projection does not match canonical repertory slot');
  }

  const card = stageCards.cards?.find((candidate) => candidate.production_id === projection.production_id);
  if (!card || card.title !== projection.title || card.short_synopsis !== projection.synopsis) {
    throw new Error('projection does not match canonical public stage card');
  }

  const source = {
    projection,
    repertory_slot: slot,
    production: repertory.productions?.find((candidate) => candidate.id === projection.production_id),
    stage_card: card,
    boundaries: {
      repertory_runtime_integration: repertory.activation_boundary.runtime_integration,
      stage_card_activation_status: stageCards.activation_status
    }
  };

  if (!source.production) throw new Error('canonical production is missing');

  return Object.freeze({
    schema_version: 1,
    attestation_id: `stage-attestation:${projection.projection_id}`,
    projection_id: projection.projection_id,
    production_id: projection.production_id,
    utc_hour: projection.utc_hour,
    canonical_sha256: sha256(source),
    runtime_activation: false,
    evidence_class: 'programming_attestation_only',
    privacy_boundary: projection.privacy_boundary,
    rollback_route: 'remove attestation consumer; canonical repertory and stage cards remain unchanged'
  });
}

module.exports = { attestProgrammedStage, canonicalize };
