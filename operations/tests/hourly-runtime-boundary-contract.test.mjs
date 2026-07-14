import test from 'node:test';
import assert from 'node:assert/strict';
import { assessHourlyRuntimeBoundary, assertHourlyRuntimeBoundary } from '../tools/hourly-runtime-boundary-contract.mjs';

test('current entrypoint remains inert and safe before hourly runtime integration', () => {
  const result = assertHourlyRuntimeBoundary({
    entrySource: "import App from './components/App';\ninstallAudioObservabilityRuntime();\n"
  });

  assert.equal(result.runtime_state, 'not_installed');
  assert.equal(result.safe_to_integrate, true);
  assert.equal(result.public_adapter_used, false);
});

test('installed runtime must consume the public adapter and preserve interaction safeguards', () => {
  const result = assertHourlyRuntimeBoundary({
    entrySource: "import { installHourlyStageRuntime } from './engine/hourlyStageRuntime';\ninstallHourlyStageRuntime();",
    runtimeSource: "const payload = createPublicHourlyStagePayload(manifest);\nif (payload.controls.sound_requires_user_action && payload.controls.reduced_motion_supported) render(payload);"
  });

  assert.equal(result.runtime_state, 'installed');
  assert.equal(result.public_adapter_used, true);
  assert.equal(result.safe_to_integrate, true);
});

test('installed runtime fails closed when it bypasses the public adapter', () => {
  const result = assessHourlyRuntimeBoundary({
    entrySource: 'installHourlyStageRuntime();',
    runtimeSource: 'render(manifest.production);'
  });

  assert.equal(result.safe_to_integrate, false);
  assert.ok(result.violations.includes('hourly runtime bypasses public adapter'));
});

test('raw repertory, private continuity, autoplay, and conversion paths are rejected', () => {
  const result = assessHourlyRuntimeBoundary({
    entrySource: "import schedule from '../../operations/repertory-schedule.json';\ninstallHourlyStageRuntime();",
    runtimeSource: "const revision = continuity.revision; const private_source = source; const payment = checkout(); const autoplay = true;"
  });

  assert.equal(result.safe_to_integrate, false);
  assert.deepEqual(result.violations, [
    'raw operations import',
    'raw repertory access',
    'internal continuity revision',
    'private source field',
    'payment or conversion logic',
    'autoplay enablement',
    'hourly runtime bypasses public adapter',
    'hourly runtime omits user-action sound contract',
    'hourly runtime omits reduced-motion contract'
  ]);
});
