import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStrictJsonEvidence, StrictJsonEvidenceError } from './strict-json-evidence.mjs';

test('accepts nested unique-member JSON and retains raw digest', () => {
  const result = parseStrictJsonEvidence('{"b":2,"a":{"x":true},"list":[1,null,"z"]}');
  assert.equal(result.parsed.a.x, true);
  assert.match(result.raw_sha256, /^[a-f0-9]{64}$/);
});

test('rejects duplicate members before parser collapse', () => {
  assert.throws(
    () => parseStrictJsonEvidence('{"claim":"first","claim":"second"}'),
    error => error instanceof StrictJsonEvidenceError && error.code === 'duplicate_member'
  );
});

test('detects escaped-name equivalence as duplicate', () => {
  assert.throws(
    () => parseStrictJsonEvidence('{"a":1,"\\u0061":2}'),
    error => error.code === 'duplicate_member'
  );
});

test('permits same member name in distinct object scopes', () => {
  const result = parseStrictJsonEvidence('{"left":{"id":1},"right":{"id":2}}');
  assert.equal(result.parsed.left.id, 1);
  assert.equal(result.parsed.right.id, 2);
});

test('fails closed on non-finite numeric conversion and trailing content', () => {
  assert.throws(() => parseStrictJsonEvidence('{"n":1e400}'), error => error.code === 'non_finite_number');
  assert.throws(() => parseStrictJsonEvidence('{}{}'), error => error.code === 'trailing_content');
});
