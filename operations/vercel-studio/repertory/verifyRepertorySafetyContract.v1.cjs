'use strict';

const { validateRepertory } = require('./selectHourlyProduction.v1.cjs');

const REQUIRED_RUNTIME_CONSTRAINTS = Object.freeze({
  audio: 'explicit_user_gesture_only',
  motion: 'honor_prefers_reduced_motion',
  mobile: 'viewport_safe_and_touch_safe',
  accessibility: 'keyboard_operable_with_nonvisual_status_equivalent',
  performance: 'no_required_network_media_for_first_interaction',
  privacy: 'no_private_source_material',
  commerce: 'no_payments_or_conversion_logic',
  deployment: 'fail_closed_until_immutable_successful_vercel_identity_is_verified',
});

const ALLOWED_STATUSES = new Set([
  'repertory_contract_only',
  'proposed',
  'observed_current_stage',
]);

function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function validateProvenance(production) {
  const provenance = production.provenance;
  if (!provenance || typeof provenance !== 'object' || Array.isArray(provenance)) {
    throw new Error(`${production.id}.provenance must be an object`);
  }
  if (!Array.isArray(provenance.observed)) {
    throw new Error(`${production.id}.provenance.observed must be an array`);
  }
  for (const source of provenance.observed) {
    assertNonEmptyString(source, `${production.id}.provenance.observed source`);
  }
  if (new Set(provenance.observed).size !== provenance.observed.length) {
    throw new Error(`${production.id}.provenance.observed contains duplicate sources`);
  }
  assertNonEmptyString(provenance.inferred, `${production.id}.provenance.inferred`);
  assertNonEmptyString(provenance.experiment, `${production.id}.provenance.experiment`);
  assertNonEmptyString(provenance.current_decision, `${production.id}.provenance.current_decision`);
}

function verifyRepertorySafetyContract(repertory) {
  validateRepertory(repertory);

  if (repertory.timezone !== 'UTC') {
    throw new Error('repertory timezone must be UTC');
  }
  if (!repertory.selection_rule || repertory.selection_rule.type !== 'deterministic_modulo') {
    throw new Error('selection rule must remain deterministic_modulo');
  }
  if (repertory.selection_rule.randomness_permitted !== false) {
    throw new Error('randomness must remain prohibited');
  }
  if (repertory.selection_rule.continuity_state_preserved_across_productions !== true) {
    throw new Error('continuity state preservation must remain explicit');
  }

  const constraints = repertory.global_runtime_constraints;
  if (!constraints || typeof constraints !== 'object' || Array.isArray(constraints)) {
    throw new Error('global_runtime_constraints must be an object');
  }
  for (const [key, expected] of Object.entries(REQUIRED_RUNTIME_CONSTRAINTS)) {
    if (constraints[key] !== expected) {
      throw new Error(`global_runtime_constraints.${key} must equal ${expected}`);
    }
  }
  const unknownConstraints = Object.keys(constraints).filter(
    (key) => !Object.prototype.hasOwnProperty.call(REQUIRED_RUNTIME_CONSTRAINTS, key),
  );
  if (unknownConstraints.length > 0) {
    throw new Error(`unknown global runtime constraints: ${unknownConstraints.join(', ')}`);
  }

  const currentStages = [];
  for (const production of repertory.productions) {
    assertNonEmptyString(production.title, `${production.id}.title`);
    assertNonEmptyString(production.form, `${production.id}.form`);
    assertNonEmptyString(production.continuity_role, `${production.id}.continuity_role`);
    if (!ALLOWED_STATUSES.has(production.status)) {
      throw new Error(`${production.id}.status is not permitted`);
    }
    validateProvenance(production);
    if (production.status === 'observed_current_stage') {
      currentStages.push(production.id);
      if (production.provenance.observed.length === 0) {
        throw new Error(`${production.id} cannot be observed_current_stage without observed sources`);
      }
    }
  }
  if (currentStages.length !== 1) {
    throw new Error('exactly one production must be the observed_current_stage');
  }

  const boundary = repertory.activation_boundary;
  if (!boundary || boundary.runtime_integration !== 'not_performed') {
    throw new Error('runtime integration must remain not_performed in the operations-only contract');
  }
  if (!Array.isArray(boundary.required_before_activation) || boundary.required_before_activation.length < 3) {
    throw new Error('activation boundary must retain explicit prerequisites');
  }
  if (!boundary.required_before_activation.some((item) => item.includes('immutable successful Vercel deployment identity'))) {
    throw new Error('activation boundary must require immutable successful Vercel deployment identity');
  }
  assertNonEmptyString(repertory.rollback, 'rollback');

  return Object.freeze({
    contract_id: 'vercel-studio-repertory-safety-v1',
    verified: true,
    deterministic: true,
    production_count: repertory.productions.length,
    current_stage_id: currentStages[0],
    privacy_boundary_preserved: true,
    commerce_absent: true,
    autoplay_absent: true,
    reduced_motion_required: true,
    mobile_safety_required: true,
    runtime_integration_performed: false,
    side_effects_performed: false,
  });
}

module.exports = {
  REQUIRED_RUNTIME_CONSTRAINTS,
  verifyRepertorySafetyContract,
};
