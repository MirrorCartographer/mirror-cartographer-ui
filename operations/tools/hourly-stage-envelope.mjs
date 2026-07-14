import { selectHourlyProduction, validateRepertory } from './hourly-repertory-selector.mjs';

function freezeProduction(production) {
  return Object.freeze({ ...production });
}

/**
 * Resolve the public repertory stage for an instant while preserving one
 * continuity channel and exposing deterministic neighboring productions.
 *
 * This module contains no private source material, browser side effects,
 * autoplay behavior, payment logic, or deployment behavior.
 */
export function createHourlyStageEnvelope({ repertory, instant, timeZone = 'UTC' }) {
  const contract = validateRepertory(repertory);
  const selected = selectHourlyProduction({ repertory, instant, timeZone });
  const currentHour = selected.resolved_hour;
  const previousHour = (currentHour + 23) % 24;
  const nextHour = (currentHour + 1) % 24;

  const byHour = new Map(repertory.map((production) => [production.hour, production]));
  const previous = byHour.get(previousHour);
  const current = byHour.get(currentHour);
  const next = byHour.get(nextHour);

  if (!previous || !current || !next) {
    throw new Error('validated repertory did not resolve a complete stage neighborhood');
  }

  return Object.freeze({
    schema_version: 1,
    selector: selected.selector,
    instant: selected.instant,
    time_zone: selected.time_zone,
    resolved_hour: currentHour,
    continuity_channel: contract.continuity_channel,
    stage: Object.freeze({
      previous: freezeProduction(previous),
      current: freezeProduction(current),
      next: freezeProduction(next)
    })
  });
}
