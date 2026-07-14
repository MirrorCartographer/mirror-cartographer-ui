function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} must be a plain object.`);
  }
  return value;
}

function requireText(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

/**
 * Creates an auditable, privacy-safe receipt for one deterministic repertory
 * stage transaction. This records runtime identity and rollback evidence only;
 * it never implies deployment, persistence, autoplay, commerce, or peer work.
 */
export function createRepertoryStageReceipt({ scheduled, projection, stage_result: stageResult, observed_at: observedAt }) {
  requireObject(scheduled, 'Scheduled slot');
  requireObject(projection, 'Projection');
  requireObject(projection.production, 'Projection production');
  requireObject(stageResult, 'Stage result');

  const slotKey = requireText(scheduled.slot_key, 'Scheduled slot key');
  const scheduledProductionId = requireText(scheduled.production_id, 'Scheduled production id');
  const projectedProductionId = requireText(projection.production.id, 'Projection production id');
  const projectedMountKey = requireText(projection.mount_key, 'Projection mount key');
  const stagedProductionId = requireText(stageResult.production_id, 'Staged production id');
  const stagedMountKey = requireText(stageResult.mount_key, 'Staged mount key');
  const timestamp = requireText(observedAt, 'Observed at');

  if (!Number.isInteger(scheduled.hour) || scheduled.hour < 0 || scheduled.hour > 23) {
    throw new RangeError('Scheduled hour must be an integer from 0 through 23.');
  }
  if (scheduledProductionId !== projectedProductionId || projectedProductionId !== stagedProductionId) {
    throw new Error('Scheduled, projected, and staged production identities diverged.');
  }
  if (projectedMountKey !== stagedMountKey) {
    throw new Error('Projected and staged mount identities diverged.');
  }
  if (stageResult.staged !== true) {
    throw new Error('A stage receipt cannot be issued for an unapplied transaction.');
  }
  if (stageResult.reversible !== true || !stageResult.rollback_selector) {
    throw new Error('A stage receipt requires a verified rollback route.');
  }

  return Object.freeze({
    schema_version: 1,
    evidence_class: 'runtime_stage_receipt',
    observed_at: timestamp,
    schedule: Object.freeze({
      slot_key: slotKey,
      hour: scheduled.hour,
      production_id: scheduledProductionId,
      deterministic: scheduled.deterministic === true,
    }),
    identity: Object.freeze({
      production_id: stagedProductionId,
      mount_key: stagedMountKey,
    }),
    runtime: Object.freeze({
      operation: requireText(stageResult.operation, 'Stage operation'),
      focus_preserved: stageResult.focus_preserved === true,
      content_strategy: requireText(stageResult.content_strategy, 'Content strategy'),
    }),
    rollback: Object.freeze({
      reversible: true,
      selector: requireText(stageResult.rollback_selector, 'Rollback selector'),
    }),
    claims: Object.freeze({
      deployment_verified: false,
      physical_device_verified: false,
      audio_audibility_verified: false,
      peer_execution_verified: false,
    }),
    privacy: Object.freeze({
      private_source_material: false,
      raw_continuity_marks: false,
    }),
  });
}
