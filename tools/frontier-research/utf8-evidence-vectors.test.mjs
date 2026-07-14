import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isUtf8 } from 'node:buffer';
import { ingestStrictJsonEvidenceBytes } from './strict-json-evidence-bytes.mjs';

const manifest = JSON.parse(await readFile(new URL('./utf8-evidence-vectors.json', import.meta.url), 'utf8'));
const decodeFatal = (bytes) => {
  try {
    new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
};

test('manifest is runtime-neutral and internally well formed', () => {
  assert.equal(manifest.schema_version, 1);
  assert.ok(Array.isArray(manifest.sources) && manifest.sources.some((source) => source.status === 'normative'));
  const ids = new Set();
  for (const vector of manifest.vectors) {
    assert.match(vector.id, /^[a-z0-9-]+$/);
    assert.equal(ids.has(vector.id), false, `duplicate id: ${vector.id}`);
    ids.add(vector.id);
    assert.match(vector.hex, /^(?:[0-9a-f]{2})+$/);
    assert.equal(typeof vector.utf8_valid, 'boolean');
    assert.equal(typeof vector.ingress, 'string');
  }
});

test('independent Node byte validators agree with manifest UTF-8 classification', () => {
  for (const vector of manifest.vectors) {
    const bytes = Buffer.from(vector.hex, 'hex');
    assert.equal(isUtf8(bytes), vector.utf8_valid, `${vector.id}: buffer.isUtf8`);
    assert.equal(decodeFatal(bytes), vector.utf8_valid, `${vector.id}: TextDecoder fatal`);
  }
});

test('strict ingress preserves byte, BOM, scalar, and duplicate-member failure classes', () => {
  for (const vector of manifest.vectors) {
    const bytes = Buffer.from(vector.hex, 'hex');
    if (vector.ingress === 'accept') {
      assert.doesNotThrow(() => ingestStrictJsonEvidenceBytes(bytes), vector.id);
    } else {
      assert.throws(
        () => ingestStrictJsonEvidenceBytes(bytes),
        (error) => error.code === vector.ingress,
        `${vector.id}: expected ${vector.ingress}`
      );
    }
  }
});
