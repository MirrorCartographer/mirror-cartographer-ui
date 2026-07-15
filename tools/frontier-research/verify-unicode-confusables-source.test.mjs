import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { verifyUnicodeConfusablesSource, enforceUnicodeConfusablesSource } from './verify-unicode-confusables-source.mjs';

const text = '# confusables.txt\n# Date: 2025-07-22, 05:49:37 GMT\n# Version: 17.0.0\n0041 ; 0041 ; MA # A\n0430 ; 0061 ; MA # CYRILLIC A\n';
const bytes = new TextEncoder().encode(text);
const manifest = {
  sourceUrl: 'https://www.unicode.org/Public/17.0.0/security/confusables.txt',
  unicodeVersion: '17.0.0',
  sha256: createHash('sha256').update(bytes).digest('hex'),
  byteLength: bytes.byteLength,
  recordCount: 2
};

test('accepts exact bytes bound to a versioned source manifest', () => {
  const result = verifyUnicodeConfusablesSource(bytes, manifest);
  assert.equal(result.verified, true);
  assert.equal(result.observed.dataDate, '2025-07-22, 05:49:37 GMT');
});

test('fails closed on byte drift', () => {
  const altered = new TextEncoder().encode(`${text}\n`);
  assert.throws(() => enforceUnicodeConfusablesSource(altered, manifest), { code: 'ERR_UNICODE_CONFUSABLES_SOURCE' });
});

test('fails closed on version drift even when digest is updated', () => {
  const changed = new TextEncoder().encode(text.replace('17.0.0', '18.0.0'));
  const result = verifyUnicodeConfusablesSource(changed, { ...manifest, sha256: createHash('sha256').update(changed).digest('hex') });
  assert.equal(result.verified, false);
  assert.ok(result.mismatches.some((entry) => entry.field === 'unicodeVersion'));
});

test('rejects latest aliases and unversioned source URLs', () => {
  assert.throws(() => verifyUnicodeConfusablesSource(bytes, { ...manifest, sourceUrl: 'https://www.unicode.org/Public/security/latest/confusables.txt' }), /exact versioned/);
});
