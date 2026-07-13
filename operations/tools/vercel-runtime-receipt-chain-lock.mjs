const SHA40 = /^[0-9a-f]{40}$/;
const REQUIRED_VERIFIERS = Object.freeze([
  'operations/tools/vercel-runtime-receipt-source-lock.mjs',
  'operations/tools/vercel-runtime-receipt-source-lock.test.mjs'
]);

function assertObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
}

function indexBindings(bindings, required, label) {
  if (!Array.isArray(bindings)) throw new TypeError(`${label} must be an array`);
  const indexed = new Map();
  for (const binding of bindings) {
    assertObject(binding, `${label} entry`);
    if (!required.includes(binding.path)) throw new Error(`unexpected ${label} path: ${binding.path}`);
    if (!SHA40.test(binding.blob_sha ?? '')) throw new Error(`invalid ${label} blob sha: ${binding.path}`);
    if (indexed.has(binding.path)) throw new Error(`duplicate ${label} path: ${binding.path}`);
    indexed.set(binding.path, binding.blob_sha);
  }
  if (indexed.size !== required.length) throw new Error(`${label} set is incomplete`);
  return indexed;
}

export function verifyRuntimeReceiptChainLock({ source_lock, verifier_sources, target_commit }) {
  assertObject(source_lock, 'source_lock');
  if (source_lock.queue_item !== 'V-001') throw new Error('source lock queue item mismatch');
  if (source_lock.source_lock_verified !== true) throw new Error('source lock is not verified');
  if (source_lock.application_deployment_attempted !== false || source_lock.deployment_claim_permitted !== false) {
    throw new Error('source lock exceeds operations-only authority');
  }
  if (!SHA40.test(target_commit ?? '')) throw new Error('invalid target commit');

  const verifierIndex = indexBindings(verifier_sources, REQUIRED_VERIFIERS, 'verifier source');

  if (!Array.isArray(source_lock.source_bindings) || source_lock.source_bindings.length === 0) {
    throw new Error('source lock has no pipeline bindings');
  }
  for (const binding of source_lock.source_bindings) {
    assertObject(binding, 'pipeline source binding');
    if (typeof binding.path !== 'string' || binding.path.length === 0) throw new Error('invalid pipeline source path');
    if (!SHA40.test(binding.blob_sha ?? '')) throw new Error(`invalid pipeline source blob sha: ${binding.path}`);
  }

  return Object.freeze({
    schema_version: 1,
    queue_item: 'V-001',
    target_commit,
    receipt_chain_locked: true,
    pipeline_source_bindings: Object.freeze(source_lock.source_bindings.map((binding) => Object.freeze({ ...binding }))),
    verifier_source_bindings: Object.freeze(REQUIRED_VERIFIERS.map((path) => Object.freeze({ path, blob_sha: verifierIndex.get(path) }))),
    application_deployment_attempted: false,
    deployment_claim_permitted: false,
    falsification_route: 'Change the target commit, either verifier blob, any pipeline binding, or operations-only authority; chain verification must fail closed.'
  });
}
