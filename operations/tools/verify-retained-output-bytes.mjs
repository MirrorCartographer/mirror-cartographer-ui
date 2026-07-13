import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const SHA256_RE = /^[0-9a-f]{64}$/;

function reject(reason, extra = {}) {
  return {
    verified: false,
    evidence_promotable: false,
    evidence_class: 'retained_output_bytes_rejected',
    reason,
    ...extra,
  };
}

function normalizeExpected(entries) {
  if (!Array.isArray(entries) || entries.length === 0) return { error: 'retained_outputs_missing' };
  const seen = new Set();
  const normalized = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return { error: 'retained_output_entry_invalid' };
    const path = entry.path;
    const sha256 = entry.sha256;
    if (typeof path !== 'string' || !path.trim()) return { error: 'retained_output_path_invalid' };
    if (!SHA256_RE.test(sha256 ?? '')) return { error: 'retained_output_sha256_invalid', path };
    if (seen.has(path)) return { error: 'retained_output_duplicate_path', path };
    seen.add(path);
    normalized.push({ path, sha256 });
  }
  normalized.sort((a, b) => a.path.localeCompare(b.path));
  return { entries: normalized };
}

async function hashRegularFile(path) {
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (error) {
    if (error.code === 'ELOOP') throw new Error('symlink_rejected');
    throw new Error(`open_failed:${error.code || error.message}`);
  }
  try {
    const stat = await handle.stat();
    if (!stat.isFile()) throw new Error('not_regular_file');
    const hash = createHash('sha256');
    const stream = handle.createReadStream({ autoClose: false });
    for await (const chunk of stream) hash.update(chunk);
    return { sha256: hash.digest('hex'), size_bytes: stat.size };
  } finally {
    await handle.close().catch(() => {});
  }
}

/**
 * Verify that every declared retained-output SHA-256 digest matches the bytes
 * currently stored at its path. This proves byte agreement only; it does not
 * prove retrieval authenticity, enumeration completeness, deployment identity,
 * browser behavior, audio audibility, or physical-device acceptance.
 */
export async function verifyRetainedOutputBytes({ retained_outputs: retainedOutputs }) {
  const normalized = normalizeExpected(retainedOutputs);
  if (normalized.error) return reject(normalized.error, normalized.path ? { path: normalized.path } : {});

  const observed = [];
  for (const entry of normalized.entries) {
    let hashed;
    try {
      hashed = await hashRegularFile(entry.path);
    } catch (error) {
      return reject(`retained_output_${error.message}`, { path: entry.path });
    }
    if (hashed.sha256 !== entry.sha256) {
      return reject('retained_output_byte_digest_mismatch', {
        path: entry.path,
        expected_sha256: entry.sha256,
        observed_sha256: hashed.sha256,
        size_bytes: hashed.size_bytes,
      });
    }
    observed.push({ path: entry.path, sha256: hashed.sha256, size_bytes: hashed.size_bytes });
  }

  return {
    verified: true,
    evidence_promotable: true,
    evidence_class: 'path_bound_retained_output_bytes_sha256',
    reason: 'retained_output_bytes_verified',
    retained_outputs: observed,
    claim_boundary: [
      'Proves only that each declared path was a regular non-symlink file whose current bytes matched its declared SHA-256 digest.',
      'Does not prove retrieval authenticity, enumeration completeness, deployment identity, browser behavior, audio audibility, or physical-device acceptance.',
    ],
  };
}
