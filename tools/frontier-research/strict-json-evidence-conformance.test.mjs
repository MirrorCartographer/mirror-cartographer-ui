import test from 'node:test';
import assert from 'node:assert/strict';
import { isUtf8 } from 'node:buffer';
import { ingestStrictJsonEvidenceBytes } from './strict-json-evidence-bytes.mjs';

const ascii = (value) => Buffer.from(value, 'ascii');
const wrapStringBytes = (payload) => Buffer.concat([
  ascii('{"v":"'),
  Buffer.from(payload),
  ascii('"}')
]);

const utf8Vectors = [
  { id: 'ascii', bytes: ascii('{"v":"A"}'), valid: true },
  { id: 'two-byte-min', bytes: wrapStringBytes([0xc2, 0x80]), valid: true },
  { id: 'three-byte-min', bytes: wrapStringBytes([0xe0, 0xa0, 0x80]), valid: true },
  { id: 'bmp-before-surrogates', bytes: wrapStringBytes([0xed, 0x9f, 0xbf]), valid: true },
  { id: 'bmp-after-surrogates', bytes: wrapStringBytes([0xee, 0x80, 0x80]), valid: true },
  { id: 'four-byte-min', bytes: wrapStringBytes([0xf0, 0x90, 0x80, 0x80]), valid: true },
  { id: 'unicode-max', bytes: wrapStringBytes([0xf4, 0x8f, 0xbf, 0xbf]), valid: true },
  { id: 'unexpected-continuation', bytes: wrapStringBytes([0x80]), valid: false },
  { id: 'truncated-two-byte', bytes: wrapStringBytes([0xc2]), valid: false },
  { id: 'truncated-three-byte', bytes: wrapStringBytes([0xe2, 0x82]), valid: false },
  { id: 'overlong-nul-two-byte', bytes: wrapStringBytes([0xc0, 0x80]), valid: false },
  { id: 'overlong-slash-three-byte', bytes: wrapStringBytes([0xe0, 0x80, 0xaf]), valid: false },
  { id: 'surrogate-encoded', bytes: wrapStringBytes([0xed, 0xa0, 0x80]), valid: false },
  { id: 'above-unicode-max', bytes: wrapStringBytes([0xf4, 0x90, 0x80, 0x80]), valid: false },
  { id: 'obsolete-five-byte-lead', bytes: wrapStringBytes([0xf8, 0x88, 0x80, 0x80, 0x80]), valid: false }
];

test('RFC 3629 boundary vectors agree with node:buffer isUtf8', () => {
  for (const vector of utf8Vectors) {
    assert.equal(isUtf8(vector.bytes), vector.valid, vector.id);
    if (vector.valid) {
      assert.doesNotThrow(() => ingestStrictJsonEvidenceBytes(vector.bytes), vector.id);
    } else {
      assert.throws(
        () => ingestStrictJsonEvidenceBytes(vector.bytes),
        (error) => error.code === 'invalid_utf8',
        vector.id
      );
    }
  }
});

test('serialization and Unicode scalar failures remain distinct from invalid UTF-8', () => {
  const cases = [
    {
      id: 'bom',
      bytes: Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), ascii('{}')]),
      code: 'utf8_bom_forbidden'
    },
    { id: 'leading-surrogate-escape', bytes: ascii('{"v":"\\ud800"}'), code: 'lone_surrogate' },
    { id: 'trailing-surrogate-escape', bytes: ascii('{"v":"\\udc00"}'), code: 'lone_surrogate' },
    { id: 'escaped-equivalent-duplicate', bytes: ascii('{"a":1,"\\u0061":2}'), code: 'duplicate_member' }
  ];

  for (const candidate of cases) {
    assert.equal(isUtf8(candidate.bytes), true, `${candidate.id}: bytes must be valid UTF-8`);
    assert.throws(
      () => ingestStrictJsonEvidenceBytes(candidate.bytes),
      (error) => error.code === candidate.code,
      candidate.id
    );
  }
});

test('resource ceilings fail before semantic acceptance', () => {
  assert.throws(
    () => ingestStrictJsonEvidenceBytes(ascii('{"v":1}'), { maxBytes: 4 }),
    (error) => error.code === 'max_bytes_exceeded'
  );
  assert.throws(
    () => ingestStrictJsonEvidenceBytes(ascii('[[[]]]'), { maxDepth: 2 }),
    (error) => error.code === 'max_depth_exceeded'
  );
});
