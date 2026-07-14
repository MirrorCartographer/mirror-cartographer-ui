import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { ingestStrictJsonEvidenceBytes } from './strict-json-evidence-bytes.mjs';

const encode = (text) => new TextEncoder().encode(text);

function rejects(code, fn) {
  assert.throws(fn, (error) => error?.code === code);
}

test('accepts well-formed UTF-8 and hashes original bytes', () => {
  const bytes = encode('{"label":"café 🌒"}');
  const result = ingestStrictJsonEvidenceBytes(bytes);
  assert.equal(result.parsed.label, 'café 🌒');
  assert.equal(result.raw_sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(result.raw_byte_length, bytes.byteLength);
});

test('rejects malformed and overlong UTF-8 instead of replacement decoding', () => {
  rejects('invalid_utf8', () => ingestStrictJsonEvidenceBytes(Uint8Array.from([0x7b, 0x22, 0x78, 0x22, 0x3a, 0xc0, 0xaf, 0x7d])));
});

test('rejects a UTF-8 BOM to preserve one serialized identity', () => {
  const json = encode('{"ok":true}');
  const bytes = Uint8Array.from([0xef, 0xbb, 0xbf, ...json]);
  rejects('utf8_bom_forbidden', () => ingestStrictJsonEvidenceBytes(bytes));
});

test('enforces a byte ceiling before decoding', () => {
  rejects('max_bytes_exceeded', () => ingestStrictJsonEvidenceBytes(encode('{"ok":true}'), { maxBytes: 4 }));
});

test('enforces bounded structural depth outside strings', () => {
  rejects('max_depth_exceeded', () => ingestStrictJsonEvidenceBytes(encode('{"a":[{"b":true}]}'), { maxDepth: 2 }));
  assert.equal(ingestStrictJsonEvidenceBytes(encode('{"text":"[[["}'), { maxDepth: 1 }).parsed.text, '[[[');
});

test('rejects lone surrogate escapes in values and member names', () => {
  rejects('lone_surrogate', () => ingestStrictJsonEvidenceBytes(encode('{"x":"\\ud800"}')));
  rejects('lone_surrogate', () => ingestStrictJsonEvidenceBytes(encode('{"\\udc00":true}')));
});

test('retains duplicate-member rejection from the strict parser', () => {
  rejects('duplicate_member', () => ingestStrictJsonEvidenceBytes(encode('{"a":1,"\\u0061":2}')));
});
