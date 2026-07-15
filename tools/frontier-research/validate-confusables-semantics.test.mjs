import test from 'node:test';
import assert from 'node:assert/strict';
import { validateConfusablesSemantics } from './validate-confusables-semantics.mjs';

const header = '# confusables.txt\n# Version: 17.0.0\n# Date: 2025-07-22\n';

test('accepts deterministic MA mappings whose targets are already terminal', () => {
  const result = validateConfusablesSemantics(
    `${header}0441 ; 0063 ; MA # CYRILLIC SMALL LETTER ES -> c\n2CA5 ; 0063 ; MA\n`,
    { expectedVersion: '17.0.0' }
  );

  assert.equal(result.recordCount, 2);
  assert.equal(result.unicodeVersion, '17.0.0');
  assert.match(result.canonicalSha256, /^[0-9a-f]{64}$/u);
  assert.equal(result.invariants.idempotentMappings, true);
});

test('rejects a payload whose declared Unicode version drifts', () => {
  assert.throws(
    () => validateConfusablesSemantics(header.replace('17.0.0', '16.0.0') + '0441 ; 0063 ; MA\n', {
      expectedVersion: '17.0.0'
    }),
    { code: 'ERR_CONFUSABLES_VERSION_MISMATCH' }
  );
});

test('rejects obsolete or unknown mapping-type fields', () => {
  assert.throws(
    () => validateConfusablesSemantics(`${header}0441 ; 0063 ; SL\n`, { expectedVersion: '17.0.0' }),
    { code: 'ERR_CONFUSABLES_MAPPING_TYPE' }
  );
});

test('rejects duplicate source mappings', () => {
  assert.throws(
    () => validateConfusablesSemantics(`${header}0441 ; 0063 ; MA\n0441 ; 006F ; MA\n`, {
      expectedVersion: '17.0.0'
    }),
    { code: 'ERR_CONFUSABLES_DUPLICATE_SOURCE' }
  );
});

test('rejects mappings that require recursive application', () => {
  assert.throws(
    () => validateConfusablesSemantics(`${header}0441 ; 0063 ; MA\n0063 ; 006F ; MA\n`, {
      expectedVersion: '17.0.0'
    }),
    { code: 'ERR_CONFUSABLES_NOT_IDEMPOTENT' }
  );
});

test('rejects surrogate and out-of-range code points', () => {
  assert.throws(
    () => validateConfusablesSemantics(`${header}D800 ; 0063 ; MA\n`, { expectedVersion: '17.0.0' }),
    { code: 'ERR_CONFUSABLES_UNICODE_SCALAR' }
  );
  assert.throws(
    () => validateConfusablesSemantics(`${header}110000 ; 0063 ; MA\n`, { expectedVersion: '17.0.0' }),
    { code: 'ERR_CONFUSABLES_UNICODE_SCALAR' }
  );
});
