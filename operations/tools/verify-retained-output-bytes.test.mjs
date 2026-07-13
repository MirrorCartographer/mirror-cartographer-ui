import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { verifyRetainedOutputBytes } from './verify-retained-output-bytes.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'retained-bytes-'));
  const path = join(dir, 'raw.json');
  const bytes = Buffer.from('{"ok":true}\n');
  await writeFile(path, bytes);
  return { dir, path, bytes };
}

test('accepts regular file whose bytes match the declared digest', async () => {
  const { path, bytes } = await fixture();
  const result = await verifyRetainedOutputBytes({ retained_outputs: [{ path, sha256: digest(bytes) }] });
  assert.equal(result.verified, true);
  assert.equal(result.retained_outputs[0].size_bytes, bytes.length);
});

test('fails closed when current bytes differ', async () => {
  const { path } = await fixture();
  const result = await verifyRetainedOutputBytes({ retained_outputs: [{ path, sha256: digest('different') }] });
  assert.equal(result.verified, false);
  assert.equal(result.reason, 'retained_output_byte_digest_mismatch');
});

test('rejects duplicate declared paths', async () => {
  const { path, bytes } = await fixture();
  const entry = { path, sha256: digest(bytes) };
  const result = await verifyRetainedOutputBytes({ retained_outputs: [entry, entry] });
  assert.equal(result.verified, false);
  assert.equal(result.reason, 'retained_output_duplicate_path');
});

test('rejects symbolic links', async () => {
  const { dir, path, bytes } = await fixture();
  const link = join(dir, 'linked.json');
  await symlink(path, link);
  const result = await verifyRetainedOutputBytes({ retained_outputs: [{ path: link, sha256: digest(bytes) }] });
  assert.equal(result.verified, false);
  assert.equal(result.reason, 'retained_output_symlink_rejected');
});
