import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';

const SHA256 = /^[0-9a-f]{64}$/;

function fail(reason, details = {}) {
  return { verified: false, reason, ...details };
}

function resolveEvidencePath(path, cwd) {
  return isAbsolute(path) ? path : resolve(cwd, path);
}

export async function verifyRetainedRawOutputBinding(input, { cwd = process.cwd() } = {}) {
  if (!input || typeof input !== 'object') return fail('manifest_invalid');

  const retained = {};
  for (const method of ['primary', 'independent']) {
    const declaration = input[method];
    if (!declaration || typeof declaration !== 'object') return fail('method_missing', { method });
    if (typeof declaration.raw_output_path !== 'string' || declaration.raw_output_path.length === 0) {
      return fail('raw_output_path_missing', { method });
    }
    if (!SHA256.test(declaration.raw_output_sha256 ?? '')) return fail('raw_output_hash_invalid', { method });

    const requestedPath = resolveEvidencePath(declaration.raw_output_path, cwd);
    let canonicalPath;
    let bytes;
    try {
      canonicalPath = await realpath(requestedPath);
      bytes = await readFile(canonicalPath);
    } catch (error) {
      return fail('raw_output_unreadable', { method, code: error?.code ?? 'unknown' });
    }

    const computedSha256 = createHash('sha256').update(bytes).digest('hex');
    if (computedSha256 !== declaration.raw_output_sha256) {
      return fail('raw_output_digest_mismatch', {
        method,
        declared_sha256: declaration.raw_output_sha256,
        computed_sha256: computedSha256
      });
    }

    retained[method] = {
      canonical_path: canonicalPath,
      byte_length: bytes.byteLength,
      sha256: computedSha256
    };
  }

  if (retained.primary.canonical_path === retained.independent.canonical_path) {
    return fail('independent_raw_output_reuses_primary_file');
  }

  return {
    verified: true,
    reason: 'retained_raw_output_binding_valid',
    primary: retained.primary,
    independent: retained.independent
  };
}
