'use strict';

const {
  selectHourlyProduction,
  validateRepertory,
} = require('./selectHourlyProduction.v1.cjs');
const {
  transitionHourlyProduction,
  validatePublicContinuityState,
} = require('./transitionHourlyProduction.v1.cjs');

/**
 * Operations-only verifier for a complete 24-hour repertory cycle.
 * It performs no network, browser, storage, audio, commerce, analytics,
 * deployment, or application-runtime operations.
 */
function verifyHourlyContinuityCycle(repertory, seedContinuityState) {
  validateRepertory(repertory);
  validatePublicContinuityState(seedContinuityState);

  const canonicalState = JSON.stringify(seedContinuityState);
  const transitions = [];

  for (let fromUtcHour = 0; fromUtcHour < 24; fromUtcHour += 1) {
    const toUtcHour = (fromUtcHour + 1) % 24;
    const transition = transitionHourlyProduction(
      repertory,
      seedContinuityState,
      fromUtcHour,
      toUtcHour,
    );
    const expectedFrom = selectHourlyProduction(repertory, fromUtcHour);
    const expectedTo = selectHourlyProduction(repertory, toUtcHour);

    if (transition.contract_id !== 'vercel-studio-hourly-transition-v1') {
      throw new Error(`hour ${fromUtcHour} returned an unknown transition contract`);
    }
    if (transition.from.production_id !== expectedFrom.production_id) {
      throw new Error(`hour ${fromUtcHour} transition source diverged from repertory selection`);
    }
    if (transition.to.production_id !== expectedTo.production_id) {
      throw new Error(`hour ${fromUtcHour} transition destination diverged from repertory selection`);
    }
    if (!transition.continuity_state_preserved) {
      throw new Error(`hour ${fromUtcHour} did not preserve continuity state`);
    }
    if (transition.side_effects_performed) {
      throw new Error(`hour ${fromUtcHour} reported a side effect`);
    }
    if (JSON.stringify(transition.continuity_state) !== canonicalState) {
      throw new Error(`hour ${fromUtcHour} changed continuity state`);
    }

    transitions.push(Object.freeze({
      from_utc_hour: fromUtcHour,
      to_utc_hour: toUtcHour,
      from_production_id: transition.from.production_id,
      to_production_id: transition.to.production_id,
      production_changed: transition.production_changed,
      continuity_state_preserved: true,
      side_effects_performed: false,
    }));
  }

  return Object.freeze({
    contract_id: 'vercel-studio-hourly-continuity-cycle-v1',
    verified: true,
    hours_covered: 24,
    includes_day_boundary: true,
    deterministic: true,
    continuity_state_preserved: true,
    side_effects_performed: false,
    transitions: Object.freeze(transitions),
  });
}

module.exports = {
  verifyHourlyContinuityCycle,
};
