const FORBIDDEN_RUNTIME_PATTERNS = Object.freeze([
  { label: 'raw operations import', pattern: /(?:from\s+['"][^'"]*operations\/|import\s*\([^)]*operations\/)/i },
  { label: 'raw repertory access', pattern: /(?:repertory(?:-schedule|Schedule)?\.json|HOURLY_REPERTORY)/i },
  { label: 'internal continuity revision', pattern: /continuity(?:\.|\[['"])?revision/i },
  { label: 'private source field', pattern: /private[_-]?source/i },
  { label: 'payment or conversion logic', pattern: /\b(?:payment|checkout|purchase|conversion)\b/i },
  { label: 'autoplay enablement', pattern: /autoplay\s*[:=]\s*true/i }
]);

function assertSource(value, name) {
  if (typeof value !== 'string') throw new TypeError(`${name} must be source text`);
  return value;
}

export function assessHourlyRuntimeBoundary({ entrySource, runtimeSource = null } = {}) {
  const entry = assertSource(entrySource, 'entrySource');
  const runtime = runtimeSource === null ? '' : assertSource(runtimeSource, 'runtimeSource');
  const combined = `${entry}\n${runtime}`;
  const violations = FORBIDDEN_RUNTIME_PATTERNS
    .filter(({ pattern }) => pattern.test(combined))
    .map(({ label }) => label);

  const runtimeInstalled = /installHourlyStageRuntime\s*\(/.test(entry);
  const publicAdapterUsed = /createPublicHourlyStagePayload\s*\(/.test(runtime);
  const userActionSound = !runtimeInstalled || /sound_requires_user_action/.test(runtime);
  const reducedMotion = !runtimeInstalled || /reduced_motion_supported/.test(runtime);

  if (runtimeInstalled && !publicAdapterUsed) violations.push('hourly runtime bypasses public adapter');
  if (!userActionSound) violations.push('hourly runtime omits user-action sound contract');
  if (!reducedMotion) violations.push('hourly runtime omits reduced-motion contract');

  return Object.freeze({
    schema_version: 1,
    runtime_state: runtimeInstalled ? 'installed' : 'not_installed',
    public_adapter_required: true,
    public_adapter_used: publicAdapterUsed,
    safe_to_integrate: violations.length === 0,
    violations: Object.freeze([...new Set(violations)]),
    guarantees: Object.freeze({
      raw_operations_unavailable: !violations.includes('raw operations import'),
      raw_repertory_unavailable: !violations.includes('raw repertory access'),
      internal_continuity_revision_unavailable: !violations.includes('internal continuity revision'),
      private_source_material_unavailable: !violations.includes('private source field'),
      payment_or_conversion_logic_absent: !violations.includes('payment or conversion logic'),
      autoplay_disabled: !violations.includes('autoplay enablement'),
      sound_requires_user_action: userActionSound,
      reduced_motion_supported: reducedMotion
    })
  });
}

export function assertHourlyRuntimeBoundary(input) {
  const result = assessHourlyRuntimeBoundary(input);
  if (!result.safe_to_integrate) {
    throw new Error(`hourly runtime boundary rejected: ${result.violations.join(', ')}`);
  }
  return result;
}
