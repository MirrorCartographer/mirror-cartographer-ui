'use strict';

const { selectHourlyProduction, validateRepertory } = require('./selectHourlyProduction.v1.cjs');

function verifyCurrentStageCoherence(repertory, timestamp) {
  validateRepertory(repertory);
  const instant = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(instant.getTime())) throw new Error('timestamp must be a valid instant');

  const scheduled = selectHourlyProduction(repertory, instant);
  const observed = repertory.productions.filter((production) => production.status === 'observed_current_stage');
  if (observed.length !== 1) throw new Error('exactly one observed_current_stage is required');

  const coherent = observed[0].id === scheduled.production.id;
  return Object.freeze({
    contract_id: 'vercel-studio-current-stage-coherence-v1',
    verified: coherent,
    classification: coherent ? 'scheduled_observed_agreement' : 'scheduled_observed_drift',
    evaluated_at: instant.toISOString(),
    utc_hour: instant.getUTCHours(),
    scheduled_production_id: scheduled.production.id,
    observed_production_id: observed[0].id,
    runtime_activation_claimed: false,
    deployment_claimed: false,
    side_effects_performed: false,
    next_action: coherent
      ? 'Retain evidence and keep runtime activation fail-closed until immutable deployment identity is verified.'
      : 'Update the stage observation through a runtime-derived evidence process; do not edit the schedule or claim deployment to conceal drift.',
  });
}

module.exports = { verifyCurrentStageCoherence };
