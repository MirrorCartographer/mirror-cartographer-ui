const SHA256_HEX = /^[a-f0-9]{64}$/;

function bindingDigest(record) {
  return record?.plan_binding?.digest ?? record?.plan_binding_digest ?? null;
}

function bindingAlgorithm(record) {
  return record?.plan_binding?.algorithm ?? record?.plan_binding_algorithm ?? null;
}

export function verifyVercelRetainedPlanBinding({ approvedPlan, retainedManifest, reconciliationBundle }) {
  const expected = approvedPlan?.plan_binding?.digest;
  const expectedAlgorithm = approvedPlan?.plan_binding?.algorithm;
  const reasons = [];

  if (approvedPlan?.plan_binding_created !== true) reasons.push('approved_plan_not_bound');
  if (expectedAlgorithm !== 'sha256') reasons.push('approved_plan_algorithm_not_sha256');
  if (!SHA256_HEX.test(expected ?? '')) reasons.push('approved_plan_digest_invalid');

  const manifestDigest = bindingDigest(retainedManifest);
  const bundleDigest = bindingDigest(reconciliationBundle);
  const manifestAlgorithm = bindingAlgorithm(retainedManifest);
  const bundleAlgorithm = bindingAlgorithm(reconciliationBundle);

  if (!retainedManifest || typeof retainedManifest !== 'object') reasons.push('retained_manifest_missing');
  if (!reconciliationBundle || typeof reconciliationBundle !== 'object') reasons.push('reconciliation_bundle_missing');
  if (manifestAlgorithm !== 'sha256') reasons.push('retained_manifest_algorithm_not_sha256');
  if (bundleAlgorithm !== 'sha256') reasons.push('reconciliation_bundle_algorithm_not_sha256');
  if (!SHA256_HEX.test(manifestDigest ?? '')) reasons.push('retained_manifest_digest_invalid');
  if (!SHA256_HEX.test(bundleDigest ?? '')) reasons.push('reconciliation_bundle_digest_invalid');

  if (SHA256_HEX.test(expected ?? '') && SHA256_HEX.test(manifestDigest ?? '') && manifestDigest !== expected) {
    reasons.push('retained_manifest_digest_mismatch');
  }
  if (SHA256_HEX.test(expected ?? '') && SHA256_HEX.test(bundleDigest ?? '') && bundleDigest !== expected) {
    reasons.push('reconciliation_bundle_digest_mismatch');
  }
  if (SHA256_HEX.test(manifestDigest ?? '') && SHA256_HEX.test(bundleDigest ?? '') && manifestDigest !== bundleDigest) {
    reasons.push('retained_records_disagree');
  }

  const verified = reasons.length === 0;
  return {
    schema_version: 1,
    evidence_class: 'vercel_retained_plan_binding_verification',
    verified,
    promotion_allowed: verified,
    expected_plan_binding: expected ?? null,
    retained_manifest_binding: manifestDigest,
    reconciliation_bundle_binding: bundleDigest,
    reasons,
    claim_boundary: [
      'A verified result proves only digest agreement between the approved plan, retained manifest, and reconciliation bundle.',
      'It does not prove command execution, output authenticity, exhaustive provider coverage, deployment identity, browser behavior, audio audibility, or physical-device acceptance.'
    ]
  };
}
