import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseConfusables,
  confusableSkeleton,
  auditConfusableObjectKeys,
  enforceNoConfusableObjectKeys
} from './uts39-confusable-key-audit.mjs';

const FIXTURE = `# Unicode Security Mechanisms for UTS #39\n# Version: 17.0.0\n0430 ; 0061 ; MA # CYRILLIC SMALL LETTER A -> LATIN SMALL LETTER A\n03BF ; 006F ; MA # GREEK SMALL LETTER OMICRON -> LATIN SMALL LETTER O\n`;

test('parses and pins Unicode confusables version and digest', () => {
  const dataset = parseConfusables(FIXTURE, { expectedVersion: '17.0.0' });
  assert.equal(dataset.version, '17.0.0');
  assert.match(dataset.sourceSha256, /^[0-9a-f]{64}$/u);
  assert.throws(() => parseConfusables(FIXTURE, { expectedVersion: '16.0.0' }), /version mismatch/u);
});

test('detects Latin and Cyrillic lookalike keys without mutation', () => {
  const dataset = parseConfusables(FIXTURE);
  const input = { alpha: 1, '\u0430lpha': 2 };
  const before = JSON.stringify(input);
  const collisions = auditConfusableObjectKeys(input, dataset);
  assert.equal(collisions.length, 1);
  assert.deepEqual(collisions[0].keys, ['alpha', '\u0430lpha']);
  assert.equal(collisions[0].objectPath, '/');
  assert.equal(JSON.stringify(input), before);
});

test('does not conflate equivalent skeletons in separate objects', () => {
  const dataset = parseConfusables(FIXTURE);
  const input = { left: { alpha: 1 }, right: { '\u0430lpha': 2 } };
  assert.deepEqual(auditConfusableObjectKeys(input, dataset), []);
});

test('reports escaped nested object paths and enforcement fails closed', () => {
  const dataset = parseConfusables(FIXTURE);
  const input = { 'a/b': { token: 1, 't\u03BFken': 2 } };
  const collisions = auditConfusableObjectKeys(input, dataset);
  assert.equal(collisions[0].objectPath, '/a~1b');
  assert.equal(confusableSkeleton('t\u03BFken', dataset), 'token');
  assert.throws(
    () => enforceNoConfusableObjectKeys(input, dataset),
    (error) => error.code === 'ERR_CONFUSABLE_OBJECT_KEYS' && error.collisions.length === 1
  );
});
