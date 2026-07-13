const SHA40 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;

function assertObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
}

function assertSha(value, pattern, name) {
  if (!pattern.test(value ?? '')) throw new Error(`invalid ${name}`);
}

function assertSafeRelativePath(value, name) {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${name} path missing`);
  if (value.startsWith('/') || value.includes('\\')) throw new Error(`${name} path must be repository-relative`);
  const segments = value.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new Error(`${name} path must be normalized`);
  }
}

function validateBindings(bindings, name) {
  if (!Array.isArray(bindings) || bindings.length === 0) {
    throw new Error(`${name} missing`);
  }

  const seenPaths = new Set();
  return bindings.map((entry, index) => {
    assertObject(entry, `${name}[${index}]`);
    assertSafeRelativePath(entry.path, `${name}[${index}]`);
    assertSha(entry.blob_sha, SHA40, `${name}[${index}] blob sha`);
    if (seenPaths.has(entry.path)) throw new Error(`${name} contains duplicate path`);
    seenPaths.add(entry.path);
    return Object.freeze({ path: entry.path, blob_sha: entry.blob_sha });
  });
}

export function bindRetainedEvidenceChainReceipt({ pipeline_receipt, chain_lock }) {
  assertObject(pipeline_receipt, 'pipeline_receipt');
  assertObject(chain_lock, 'chain_lock');

  if (pipeline_receipt.schema_version !== 1 || chain_lock.schema_version !== 1) {
    throw new Error('unsupported schema version');
  }
  if (chain_lock.queue_item !== 'V-001' || pipeline_receipt.queue_item !== 'V-001') {
    throw new Error('queue item mismatch');
  }
  assertSha(pipeline_receipt.target_commit, SHA40, 'pipeline target commit');
  assertSha(chain_lock.target_commit, SHA40, 'chain target commit');
  if (pipeline_receipt.target_commit !== chain_lock.target_commit) {
    throw new Error('target commit mismatch');
  }
  if (pipeline_receipt.receipt_verified !== true) throw new Error('pipeline receipt is not verified');
  if (chain_lock.receipt_chain_locked !== true) throw new Error('receipt chain is not locked');
  if (pipeline_receipt.application_deployment_attempted !== false || chain_lock.application_deployment_attempted !== false) {
    throw new Error('application deployment authority exceeded');
  }
  if (pipeline_receipt.deployment_claim_permitted !== false || chain_lock.deployment_claim_permitted !== false) {
    throw new Error('deployment claim authority exceeded');
  }

  assertSha(pipeline_receipt.manifest_sha256, SHA256, 'manifest digest');
  const pipelineSourceBindings = validateBindings(chain_lock.pipeline_source_bindings, 'pipeline source bindings');
  const verifierSourceBindings = validateBindings(chain_lock.verifier_source_bindings, 'verifier source bindings');

  return Object.freeze({
    schema_version: 1,
    queue_item: 'V-001',
    target_commit: pipeline_receipt.target_commit,
    retained_evidence_chain_verified: true,
    manifest_sha256: pipeline_receipt.manifest_sha256,
    retained_artifact_digests: Object.freeze({ ...(pipeline_receipt.retained_artifact_digests ?? {}) }),
    pipeline_source_bindings: Object.freeze(pipelineSourceBindings),
    verifier_source_bindings: Object.freeze(verifierSourceBindings),
    application_deployment_attempted: false,
    deployment_claim_permitted: false,
    falsification_route: 'Change the target commit, manifest digest, receipt verification state, chain-lock state, source binding path or blob SHA, or operations-only authority; composite receipt creation must fail closed.'
  });
}
