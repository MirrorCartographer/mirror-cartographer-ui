import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyRetainedRawOutputBinding } from './retained-raw-output-binding.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

async function run() {
  const dir = await mkdtemp(join(tmpdir(), 'mc-retained-binding-'));
  const primaryPath = join(dir, 'primary.json');
  const independentPath = join(dir, 'independent.json');
  const aliasPath = join(dir, 'primary-alias.json');
  const primaryBytes = Buffer.from('{"client":"repository-enumerator","runs":[1,2]}\n');
  const independentBytes = Buffer.from('[{"client":"gh-api","runs":[1,2]}]\n');
  await writeFile(primaryPath, primaryBytes);
  await writeFile(independentPath, independentBytes);
  await symlink(primaryPath, aliasPath);

  const valid = {
    primary: { raw_output_path: primaryPath, raw_output_sha256: sha256(primaryBytes) },
    independent: { raw_output_path: independentPath, raw_output_sha256: sha256(independentBytes) }
  };

  let result = await verifyRetainedRawOutputBinding(valid);
  assert.equal(result.verified, true);
  assert.equal(result.primary.byte_length, primaryBytes.byteLength);
  assert.equal(result.independent.byte_length, independentBytes.byteLength);

  result = await verifyRetainedRawOutputBinding({
    ...valid,
    primary: { ...valid.primary, raw_output_sha256: '0'.repeat(64) }
  });
  assert.equal(result.reason, 'raw_output_digest_mismatch');
  assert.equal(result.method, 'primary');

  result = await verifyRetainedRawOutputBinding({
    ...valid,
    independent: { ...valid.independent, raw_output_path: join(dir, 'missing.json') }
  });
  assert.equal(result.reason, 'raw_output_unreadable');
  assert.equal(result.method, 'independent');

  result = await verifyRetainedRawOutputBinding({
    ...valid,
    independent: { ...valid.primary, raw_output_path: aliasPath }
  });
  assert.equal(result.reason, 'independent_raw_output_reuses_primary_file');

  result = await verifyRetainedRawOutputBinding({
    primary: { raw_output_path: primaryPath, raw_output_sha256: sha256(primaryBytes) },
    independent: { raw_output_path: independentPath, raw_output_sha256: '' }
  });
  assert.equal(result.reason, 'raw_output_hash_invalid');
  assert.equal(result.method, 'independent');

  console.log('10 assertions passed');
}

run();
