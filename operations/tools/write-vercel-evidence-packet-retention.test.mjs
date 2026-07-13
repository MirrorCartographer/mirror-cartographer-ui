import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyRetainedText } from './write-vercel-evidence-packet.mjs';

test('accepts an exact retained evidence byte sequence', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vercel-retained-evidence-'));
  const path = join(dir, 'retained.json');
  const expected = '{"status":"retained"}\n';
  await writeFile(path, expected, 'utf8');
  const result = await verifyRetainedText(path, expected, 'retained_bytes_mismatch');
  assert.equal(result.exact_byte_match, true);
  assert.equal(result.path, path);
});

test('rejects a retained evidence byte sequence that differs', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'vercel-retained-evidence-'));
  const path = join(dir, 'retained.json');
  await writeFile(path, '{"status":"different"}\n', 'utf8');
  await assert.rejects(
    () => verifyRetainedText(path, '{"status":"expected"}\n', 'retained_bytes_mismatch'),
    /retained_bytes_mismatch/
  );
});
