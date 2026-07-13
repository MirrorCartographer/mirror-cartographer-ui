import { resolve, relative, isAbsolute, sep, basename } from 'node:path';
import { verifyRetainedOutputBytes } from './verify-retained-output-bytes.mjs';

function reject(reason, extra = {}) {
  return {
    verified: false,
    evidence_promotable: false,
    evidence_class: 'retained_output_scope_rejected',
    reason,
    ...extra,
  };
}

function normalizeAllowedNames(names) {
  if (!Array.isArray(names) || names.length === 0) return { error: 'allowed_output_names_missing' };
  const seen = new Set();
  const normalized = [];
  for (const name of names) {
    if (typeof name !== 'string' || !name.trim()) return { error: 'allowed_output_name_invalid' };
    if (name !== basename(name) || name === '.' || name === '..') return { error: 'allowed_output_name_not_basename', name };
    if (seen.has(name)) return { error: 'allowed_output_name_duplicate', name };
    seen.add(name);
    normalized.push(name);
  }
  normalized.sort();
  return { names: normalized };
}

/**
 * Verify retained outputs only after proving every path is an immediate child of
 * one approved retention directory and its basename is explicitly allowlisted.
 * The delegated byte verifier still rejects symlinks and digest mismatch.
 */
export async function verifyRetainedOutputScope({ retention_root: retentionRoot, allowed_output_names: allowedNames, retained_outputs: retainedOutputs }) {
  if (typeof retentionRoot !== 'string' || !retentionRoot.trim()) return reject('retention_root_invalid');
  const root = resolve(retentionRoot);
  const allowed = normalizeAllowedNames(allowedNames);
  if (allowed.error) return reject(allowed.error, allowed.name ? { name: allowed.name } : {});
  if (!Array.isArray(retainedOutputs) || retainedOutputs.length === 0) return reject('retained_outputs_missing');

  const allowedSet = new Set(allowed.names);
  const scoped = [];
  for (const entry of retainedOutputs) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return reject('retained_output_entry_invalid');
    if (typeof entry.path !== 'string' || !entry.path.trim()) return reject('retained_output_path_invalid');
    const path = resolve(entry.path);
    const rel = relative(root, path);
    if (!rel || isAbsolute(rel) || rel.startsWith(`..${sep}`) || rel === '..') {
      return reject('retained_output_outside_root', { path: entry.path });
    }
    if (rel.includes(sep)) return reject('retained_output_not_immediate_child', { path: entry.path });
    if (!allowedSet.has(rel)) return reject('retained_output_name_not_allowed', { path: entry.path, name: rel });
    scoped.push({ ...entry, path });
  }

  const byteResult = await verifyRetainedOutputBytes({ retained_outputs: scoped });
  if (!byteResult.verified) return { ...byteResult, scope_verified: true, retention_root: root };
  return {
    ...byteResult,
    evidence_class: 'root_scoped_path_bound_retained_output_bytes_sha256',
    scope_verified: true,
    retention_root: root,
    allowed_output_names: allowed.names,
    claim_boundary: [
      'Proves each retained path was an explicitly allowed immediate child of the approved retention directory and its current regular-file bytes matched the declared SHA-256 digest.',
      'Does not prove retrieval authenticity, enumeration completeness, deployment identity, browser behavior, audio audibility, or physical-device acceptance.',
    ],
  };
}
