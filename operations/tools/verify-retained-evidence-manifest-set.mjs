import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { verifyRetainedOutputScope } from './verify-retained-output-scope.mjs';

const SHA256_RE = /^[0-9a-f]{64}$/;
const REQUIRED_OUTPUTS = Object.freeze([
  'primary-enumeration.json',
  'independent-pages.json',
  'independent-command.txt',
  'reconciliation.json',
  'evidence-bundle.json',
]);

function reject(reason, extra = {}) {
  return {
    verified: false,
    evidence_promotable: false,
    evidence_class: 'retained_evidence_manifest_set_rejected',
    reason,
    ...extra,
  };
}

async function readJson(path, label) {
  let text;
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    throw new Error(`${label}_read_failed:${error.code || error.message}`);
  }
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('root_not_object');
    return value;
  } catch (error) {
    throw new Error(`${label}_json_invalid:${error.message}`);
  }
}

function bindingDigest(value) {
  return value?.plan_binding?.digest;
}

/**
 * Verify the exact retained-output set for V-001 and require the reconciliation
 * record and final evidence bundle to carry the approved execution-plan digest.
 * This composes path, regular-file, and byte-digest checks from the lower-level
 * verifier before parsing either JSON record.
 */
export async function verifyRetainedEvidenceManifestSet({
  retention_root: retentionRoot,
  plan_binding_digest: planBindingDigest,
  retained_outputs: retainedOutputs,
}) {
  if (!SHA256_RE.test(planBindingDigest ?? '')) return reject('plan_binding_digest_invalid');
  if (!Array.isArray(retainedOutputs)) return reject('retained_outputs_missing');

  const names = retainedOutputs.map((entry) => basename(entry?.path ?? '')).sort();
  const required = [...REQUIRED_OUTPUTS].sort();
  if (names.length !== required.length || names.some((name, index) => name !== required[index])) {
    return reject('retained_output_set_mismatch', { required_output_names: required, observed_output_names: names });
  }

  const scope = await verifyRetainedOutputScope({
    retention_root: retentionRoot,
    allowed_output_names: REQUIRED_OUTPUTS,
    retained_outputs: retainedOutputs,
  });
  if (!scope.verified) return { ...scope, manifest_set_verified: false };

  const root = resolve(retentionRoot);
  let reconciliation;
  let bundle;
  try {
    reconciliation = await readJson(resolve(root, 'reconciliation.json'), 'reconciliation');
    bundle = await readJson(resolve(root, 'evidence-bundle.json'), 'evidence_bundle');
  } catch (error) {
    return reject(error.message, { scope_verified: true, retention_root: root });
  }

  const reconciliationDigest = bindingDigest(reconciliation);
  const bundleDigest = bindingDigest(bundle);
  if (!SHA256_RE.test(reconciliationDigest ?? '')) return reject('reconciliation_plan_binding_missing_or_invalid', { scope_verified: true });
  if (!SHA256_RE.test(bundleDigest ?? '')) return reject('bundle_plan_binding_missing_or_invalid', { scope_verified: true });
  if (reconciliationDigest !== planBindingDigest) {
    return reject('reconciliation_plan_binding_mismatch', { expected_digest: planBindingDigest, observed_digest: reconciliationDigest, scope_verified: true });
  }
  if (bundleDigest !== planBindingDigest) {
    return reject('bundle_plan_binding_mismatch', { expected_digest: planBindingDigest, observed_digest: bundleDigest, scope_verified: true });
  }

  return {
    ...scope,
    verified: true,
    evidence_promotable: true,
    evidence_class: 'retained_evidence_exact_set_path_bytes_and_plan_binding_sha256',
    reason: 'retained_evidence_manifest_set_verified',
    manifest_set_verified: true,
    plan_binding_digest: planBindingDigest,
    required_output_names: required,
    claim_boundary: [
      'Proves the exact required retained-output set was present under one approved directory, each current regular-file byte sequence matched its declared SHA-256 digest, and both reconciliation and bundle records carried the approved plan-binding digest.',
      'Does not prove retrieval authenticity, enumeration completeness, GitHub or Vercel provider behavior, immutable deployment identity, browser behavior, audio audibility, or physical-device acceptance.',
    ],
  };
}
