const SHA256_RE = /^[0-9a-f]{64}$/;

function fail(reason, extra = {}) {
  return {
    ok: false,
    reason,
    evidence_promotable: false,
    evidence_class: 'retained_output_digest_rejected',
    ...extra,
  };
}

function normalizeEntries(value, label) {
  if (!Array.isArray(value) || value.length === 0) return { error: `${label}_missing` };
  const seen = new Set();
  const entries = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return { error: `${label}_entry_invalid` };
    const path = item.path;
    const digest = item.sha256;
    if (typeof path !== 'string' || !path.trim()) return { error: `${label}_path_invalid` };
    if (!SHA256_RE.test(digest ?? '')) return { error: `${label}_sha256_invalid`, path };
    if (seen.has(path)) return { error: `${label}_duplicate_path`, path };
    seen.add(path);
    entries.push({ path, sha256: digest });
  }
  entries.sort((a, b) => a.path.localeCompare(b.path));
  return { entries };
}

/**
 * Fail closed unless the retained-output manifest and reconciliation bundle
 * declare the same non-empty set of path-bound SHA-256 byte digests.
 */
export function verifyRetainedOutputDigests({ raw_manifest: rawManifest, reconciliation_bundle: bundle }) {
  if (!rawManifest || typeof rawManifest !== 'object' || Array.isArray(rawManifest)) return fail('raw_manifest_invalid');
  if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) return fail('reconciliation_bundle_invalid');

  const manifest = normalizeEntries(rawManifest.retained_outputs, 'raw_manifest_retained_outputs');
  if (manifest.error) return fail(manifest.error, manifest.path ? { path: manifest.path } : {});

  const reconciled = normalizeEntries(bundle.retained_outputs, 'reconciliation_bundle_retained_outputs');
  if (reconciled.error) return fail(reconciled.error, reconciled.path ? { path: reconciled.path } : {});

  if (manifest.entries.length !== reconciled.entries.length) {
    return fail('retained_output_count_mismatch', {
      manifest_count: manifest.entries.length,
      bundle_count: reconciled.entries.length,
    });
  }

  for (let index = 0; index < manifest.entries.length; index += 1) {
    const expected = manifest.entries[index];
    const observed = reconciled.entries[index];
    if (expected.path !== observed.path) {
      return fail('retained_output_path_mismatch', { expected_path: expected.path, observed_path: observed.path });
    }
    if (expected.sha256 !== observed.sha256) {
      return fail('retained_output_digest_mismatch', {
        path: expected.path,
        expected_sha256: expected.sha256,
        observed_sha256: observed.sha256,
      });
    }
  }

  return {
    ok: true,
    reason: 'retained_output_digests_verified',
    evidence_promotable: true,
    evidence_class: 'path_bound_retained_output_sha256_set',
    retained_outputs: manifest.entries,
    claim_boundary: [
      'Proves only that the manifest and reconciliation bundle declare the same path-bound SHA-256 digest set.',
      'Does not prove the files were retrieved authentically, that the declared hashes match current bytes, that enumeration was exhaustive, or that a deployment or device observation occurred.',
    ],
  };
}
