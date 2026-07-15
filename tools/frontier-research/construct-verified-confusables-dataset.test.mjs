import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { constructVerifiedConfusablesDataset } from './construct-verified-confusables-dataset.mjs';

const text = '# confusables.txt\n# Date: 2025-07-22, 05:49:37 GMT\n# Version: 17.0.0\n0041 ; 0041 ; MA # A\n0430 ; 0061 ; MA # CYRILLIC A\n';
const bytes = new TextEncoder().encode(text);
const manifest = {
  sourceUrl: 'https://www.unicode.org/Public/17.0.0/security/confusables.txt',
  unicodeVersion: '17.0.0',
  sha256: createHash('sha256').update(bytes).digest('hex'),
  byteLength: bytes.byteLength,
  recordCount: 2
};

test('verifies bytes before constructing the dataset', () => {
  const calls = [];
  const result = constructVerifiedConfusablesDataset(bytes, manifest, (source, options) => {
    calls.push({ source, options });
    return new Map([['0430', '0061']]);
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].source, text);
  assert.deepEqual(calls[0].options, { expectedVersion: '17.0.0' });
  assert.equal(result.dataset.get('0430'), '0061');
  assert.equal(result.source.sha256, manifest.sha256);
});

test('never invokes the parser when source verification fails', () => {
  let invoked = false;
  const altered = new TextEncoder().encode(`${text}\n`);
  assert.throws(() => constructVerifiedConfusablesDataset(altered, manifest, () => {
    invoked = true;
    return new Map();
  }), { code: 'ERR_UNICODE_CONFUSABLES_SOURCE' });
  assert.equal(invoked, false);
});

test('fails closed when the parser returns no dataset', () => {
  assert.throws(() => constructVerifiedConfusablesDataset(bytes, manifest, () => null), {
    code: 'ERR_UNICODE_CONFUSABLES_DATASET'
  });
});

test('requires an explicit parser boundary', () => {
  assert.throws(() => constructVerifiedConfusablesDataset(bytes, manifest), /parseConfusables/);
});
