const REQUIRED_ACCESSIBILITY = ['keyboard-complete', 'screen-reader-labelled', 'reduced-motion-safe'];

function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${label} must be a non-empty string`);
}

export function buildStageContract({ schedule, production, continuityState, featureFlag = false }) {
  if (!schedule || schedule.schema_version !== 1) throw new Error('schedule schema_version must equal 1');
  if (!production || !schedule.productions?.some((candidate) => candidate.id === production.id)) {
    throw new Error('production must belong to schedule');
  }
  if (production.autoplay !== false) throw new Error('autoplay must remain disabled');
  if (production.continuity_channel !== schedule.continuity?.state_channel) {
    throw new Error('production continuity channel must match schedule continuity state channel');
  }
  for (const requirement of REQUIRED_ACCESSIBILITY) {
    if (!production.accessibility?.includes(requirement)) throw new Error(`missing accessibility requirement: ${requirement}`);
  }
  if (continuityState === null || typeof continuityState !== 'object' || Array.isArray(continuityState)) {
    throw new Error('continuityState must be an object');
  }
  assertNonEmptyString(production.id, 'production.id');
  assertNonEmptyString(production.title, 'production.title');
  assertNonEmptyString(production.grammar, 'production.grammar');

  return Object.freeze({
    schema_version: 1,
    adapter_status: featureFlag ? 'eligible_for_runtime_adapter' : 'operations_preview_only',
    production: Object.freeze({
      id: production.id,
      title: production.title,
      grammar: production.grammar,
      hour: production.hour,
    }),
    continuity: Object.freeze({
      channel: schedule.continuity.state_channel,
      state: continuityState,
      ownership: 'shared',
      mutation_policy: 'preserve-and-append-only',
    }),
    media: Object.freeze({ autoplay: false, user_gesture_required: true }),
    accessibility: Object.freeze({
      keyboard_complete: true,
      screen_reader_labelled: true,
      reduced_motion_safe: true,
    }),
    privacy: Object.freeze({
      private_source_material: 'prohibited',
      public_payload: 'production-metadata-and-shared-state-only',
    }),
    payments: Object.freeze({ enabled: false, conversion_logic: false }),
    rollback: Object.freeze({ mode: 'feature-flag-off', fallback: schedule.selection.fallback }),
  });
}
