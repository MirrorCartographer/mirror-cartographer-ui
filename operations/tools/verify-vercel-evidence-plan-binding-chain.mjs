const SHA256_RE = /^[0-9a-f]{64}$/;

function fail(reason, extra = {}) {
  return {
    ok: false,
    reason,
    evidence_promotable: false,
    evidence_class: 'plan_binding_rejected',
    ...extra,
  };
}

function readDigest(record, label) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { error: `${label}_invalid` };
  }
  const binding = record.plan_binding;
  if (!binding || typeof binding !== 'object' || Array.isArray(binding)) {
    return { error: `${label}_plan_binding_missing` };
  }
  if (binding.algorithm !== 'sha256') return { error: `${label}_algorithm_invalid` };
  if (!SHA256_RE.test(binding.digest ?? '')) return { error: `${label}_digest_invalid` };
  return { digest: binding.digest };
}

/**
 * Fail closed unless a validated execution plan, retained raw-output manifest,
 * and reconciliation bundle all carry the same SHA-256 plan binding.
 */
export function verifyVercelEvidencePlanBinding({
  validated_plan: validatedPlan,
  raw_manifest: rawManifest,
  reconciliation_bundle: reconciliationBundle,
}) {
  const plan = readDigest(validatedPlan, 'validated_plan');
  if (plan.error) return fail(plan.error);

  const manifest = readDigest(rawManifest, 'raw_manifest');
  if (manifest.error) return fail(manifest.error, { expected_digest: plan.digest });

  const bundle = readDigest(reconciliationBundle, 'reconciliation_bundle');
  if (bundle.error) return fail(bundle.error, { expected_digest: plan.digest });

  if (manifest.digest !== plan.digest) {
    return fail('raw_manifest_plan_binding_mismatch', {
      expected_digest: plan.digest,
      observed_digest: manifest.digest,
    });
  }

  if (bundle.digest !== plan.digest) {
    return fail('reconciliation_bundle_plan_binding_mismatch', {
      expected_digest: plan.digest,
      observed_digest: bundle.digest,
    });
  }

  return {
    ok: true,
    reason: 'plan_binding_chain_verified',
    evidence_promotable: true,
    evidence_class: 'plan_bound_raw_manifest_and_reconciliation_bundle',
    plan_binding: {
      algorithm: 'sha256',
      digest: plan.digest,
    },
    claim_boundary: [
      'Proves only that the validated execution plan, retained raw-output manifest, and reconciliation bundle declare the same SHA-256 plan binding.',
      'Does not prove execution, authentication, raw-byte authenticity, exhaustive enumeration, deployment identity, browser behavior, audibility, or physical-device observation.',
    ],
  };
}
