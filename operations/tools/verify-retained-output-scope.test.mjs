import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { verifyRetainedOutputScope } from './verify-retained-output-scope.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');

async function fixture() {
  const base = await mkdtemp(join(tmpdir(), 'scope-'));
  const root = join(base, 'retained');
  await mkdir(root);
  const bytes = Buffer.from('{"ok":true}\n');
  const path = join(root, 'primary.json');
  await writeFile(path, bytes);
  return { base, root, path, bytes };
}

test('accepts allowed immediate child with matching bytes', async () => {
  const { root, path, bytes } = await fixture();
  const result = await verifyRetainedOutputScope({
    retention_root: root,
    allowed_output_names: ['primary.json'],
    retained_outputs: [{ path, sha256: digest(bytes) }],
  });
  assert.equal(result.verified, true);
  assert.equal(result.scope_verified, true);
});

test('rejects traversal outside root', async () => {
  const { base, root, bytes } = await fixture();
  const path = join(base, 'outside.json');
  await writeFile(path, bytes);
  const result = await verifyRetainedOutputScope({
    retention_root: root,
    allowed_output_names: ['outside.json'],
    retained_outputs: [{ path, sha256: digest(bytes) }],
  });
  assert.equal(result.reason, 'retained_output_outside_root');
});

test('rejects nested descendants even inside root', async () => {
  const { root, bytes } = await fixture();
  const nested = join(root, 'nested');
  await mkdir(nested);
  const path = join(nested, 'primary.json');
  await writeFile(path, bytes);
  const result = await verifyRetainedOutputScope({
    retention_root: root,
    allowed_output_names: ['primary.json'],
    retained_outputs: [{ path, sha256: digest(bytes) }],
  });
  assert.equal(result.reason, 'retained_output_not_immediate_child');
});

test('rejects unapproved basename', async () => {
  const { root, path, bytes } = await fixture();
  const result = await verifyRetainedOutputScope({
    retention_root: root,
    allowed_output_names: ['other.json'],
    retained_outputs: [{ path, sha256: digest(bytes) }],
  });
  assert.equal(result.reason, 'retained_output_name_not_allowed');
});
