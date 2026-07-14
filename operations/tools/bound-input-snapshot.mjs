import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export async function withBoundInputSnapshot(input, operation, { temporary_root = tmpdir() } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { verified: false, reason: 'bound_input_invalid' };
  }
  if (typeof operation !== 'function') {
    return { verified: false, reason: 'bound_operation_required' };
  }

  const canonicalBytes = Buffer.from(`${JSON.stringify(input, null, 2)}\n`, 'utf8');
  const expectedSha256 = sha256(canonicalBytes);
  const directory = await mkdtemp(join(temporary_root, 'bound-evidence-input-'));
  const snapshotPath = join(directory, `${randomUUID()}.json`);

  try {
    await writeFile(snapshotPath, canonicalBytes, { flag: 'wx', mode: 0o400 });
    const retainedBytes = await readFile(snapshotPath);
    const retainedSha256 = sha256(retainedBytes);
    if (retainedSha256 !== expectedSha256) {
      return {
        verified: false,
        reason: 'bound_input_snapshot_digest_mismatch',
        expected_sha256: expectedSha256,
        retained_sha256: retainedSha256
      };
    }

    const result = await operation(snapshotPath);
    return {
      ...result,
      bound_input_snapshot: {
        sha256: expectedSha256,
        byte_length: canonicalBytes.length,
        lifecycle: 'ephemeral_read_only_snapshot'
      }
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
