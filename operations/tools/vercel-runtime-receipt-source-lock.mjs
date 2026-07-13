const SHA40 = /^[0-9a-f]{40}$/;
const REQUIRED = Object.freeze([
  'operations/tools/vercel-retained-evidence-pipeline.mjs',
  'operations/tools/vercel-retained-evidence-pipeline.test.mjs'
]);

function assertObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`);
}

export function verifyRuntimeReceiptSourceLock({ receipt, expected_sources }) {
  assertObject(receipt, 'receipt');
  if (!Array.isArray(expected_sources)) throw new TypeError('expected_sources must be an array');
  if (receipt.queue_item !== 'V-001') throw new Error('receipt queue item mismatch');
  if (receipt.verification_state !== 'runtime_test_verified') throw new Error('receipt is not runtime-test verified');
  if (receipt.command !== 'node --test operations/tools/vercel-retained-evidence-pipeline.test.mjs') throw new Error('receipt command mismatch');
  if (receipt.exit_code !== 0 || receipt.failed !== 0 || receipt.passed !== receipt.tests || receipt.tests <= 0) {
    throw new Error('receipt test totals are not successful');
  }
  if (receipt.application_deployment_attempted !== false || receipt.deployment_claim_permitted !== false) {
    throw new Error('receipt exceeds operations-only authority');
  }

  const expected = new Map();
  for (const source of expected_sources) {
    assertObject(source, 'expected source');
    if (!REQUIRED.includes(source.path)) throw new Error(`unexpected expected source path: ${source.path}`);
    if (!SHA40.test(source.blob_sha ?? '')) throw new Error(`invalid expected blob sha: ${source.path}`);
    if (expected.has(source.path)) throw new Error(`duplicate expected source: ${source.path}`);
    expected.set(source.path, source.blob_sha);
  }
  if (expected.size !== REQUIRED.length) throw new Error('expected source set is incomplete');

  if (!Array.isArray(receipt.sources)) throw new TypeError('receipt.sources must be an array');
  const observed = new Map();
  for (const source of receipt.sources) {
    assertObject(source, 'receipt source');
    if (!REQUIRED.includes(source.path)) throw new Error(`unexpected receipt source path: ${source.path}`);
    if (!SHA40.test(source.blob_sha ?? '')) throw new Error(`invalid receipt blob sha: ${source.path}`);
    if (observed.has(source.path)) throw new Error(`duplicate receipt source: ${source.path}`);
    observed.set(source.path, source.blob_sha);
  }
  if (observed.size !== REQUIRED.length) throw new Error('receipt source set is incomplete');

  for (const path of REQUIRED) {
    if (observed.get(path) !== expected.get(path)) throw new Error(`receipt source drift: ${path}`);
  }

  return Object.freeze({
    schema_version: 1,
    queue_item: 'V-001',
    source_lock_verified: true,
    verified_command: receipt.command,
    source_bindings: Object.freeze(REQUIRED.map((path) => Object.freeze({ path, blob_sha: observed.get(path) }))),
    application_deployment_attempted: false,
    deployment_claim_permitted: false,
    falsification_route: 'Change either committed source blob, alter the approved command, or supply unsuccessful TAP totals; verification must fail closed.'
  });
}
