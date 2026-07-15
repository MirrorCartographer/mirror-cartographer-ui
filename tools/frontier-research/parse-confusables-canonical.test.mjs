import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCanonicalConfusables } from './parse-confusables-canonical.mjs';

const validText = `# Unicode Security Mechanisms for UTS #39
# Version: 17.0.0
0391 ; 0061 ; MA # GREEK CAPITAL LETTER ALPHA
0041 ; 0061 ; MA # LATIN CAPITAL LETTER A
`;

test('parses canonical mappings in scalar order', () => {
  const result = parseCanonicalConfusables(validText);
  assert.deepEqual(result.canonicalMappings, ['0041;0061;MA', '0391;0061;MA']);
  assert.ok(result.dataset instanceof Map);
  assert.deepEqual(result.dataset.get(0x41), [0x61]);
  assert.deepEqual(result.dataset.get(0x391), [0x61]);
  assert.ok(Object.isFrozen(result.dataset.get(0x41)));
});

test('canonicalizes lowercase hexadecimal input', () => {
  const result = parseCanonicalConfusables('# Version: 17.0.0\n0041 ; 0061 0300 ; MA\n');
  assert.deepEqual(result.canonicalMappings, ['0041;0061 0300;MA']);
});

test('rejects duplicate source mappings', () => {
  assert.throws(
    () => parseCanonicalConfusables('# Version: 17.0.0\n0041 ; 0061 ; MA\n0041 ; 0062 ; MA\n'),
    { code: 'ERR_CANONICAL_CONFUSABLES_DUPLICATE_SOURCE' }
  );
});

test('rejects non-MA mapping types', () => {
  assert.throws(
    () => parseCanonicalConfusables('# Version: 17.0.0\n0041 ; 0061 ; SL\n'),
    { code: 'ERR_CANONICAL_CONFUSABLES_MAPPING_TYPE' }
  );
});

test('rejects source sequences with more than one scalar', () => {
  assert.throws(
    () => parseCanonicalConfusables('# Version: 17.0.0\n0041 0042 ; 0061 ; MA\n'),
    { code: 'ERR_CANONICAL_CONFUSABLES_SOURCE_ARITY' }
  );
});

test('rejects empty datasets', () => {
  assert.throws(
    () => parseCanonicalConfusables('# Version: 17.0.0\n'),
    { code: 'ERR_CANONICAL_CONFUSABLES_NO_RECORDS' }
  );
});
