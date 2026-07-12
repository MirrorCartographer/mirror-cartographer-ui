import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveProjectAlias } from './alias-ingestion-validator.mjs';

test('resolves canonical name while preserving original surface form', () => {
  const result = resolveProjectAlias('  Mirror   Cartographer ');
  assert.equal(result.canonicalNode, 'project:mirror-cartographer');
  assert.equal(result.originalSurfaceForm, '  Mirror   Cartographer ');
  assert.equal(result.aliasClass, 'canonical');
  assert.equal(result.unresolved, false);
});

test('resolves abbreviation without creating a new node', () => {
  const result = resolveProjectAlias('MC');
  assert.equal(result.canonicalNode, 'project:mirror-cartographer');
  assert.equal(result.aliasClass, 'abbreviation');
  assert.equal(result.confidence, 1);
});

test('resolves formatting variants', () => {
  for (const alias of ['MirrorCartographer', 'mirror-cartographer', 'mirrorcartographer']) {
    const result = resolveProjectAlias(alias);
    assert.equal(result.canonicalNode, 'project:mirror-cartographer');
    assert.equal(result.unresolved, false);
  }
});

test('preserves MC mode as project plus mode relation', () => {
  const result = resolveProjectAlias('MC mode');
  assert.equal(result.canonicalNode, 'project:mirror-cartographer');
  assert.equal(result.relation, 'mode');
  assert.equal(result.aliasClass, 'nickname_or_feature_reference');
});

test('resolves only lexicon-qualified misspellings', () => {
  for (const alias of ['Miror Cartographer', 'Mirror Cartograper']) {
    const result = resolveProjectAlias(alias);
    assert.equal(result.aliasClass, 'likely_misspelling');
    assert.ok(result.confidence >= 0.95);
    assert.equal(result.unresolved, false);
  }
});

test('fails closed for ambiguous, empty, and invalid values', () => {
  for (const input of ['Mirror Mapper', '', null]) {
    const result = resolveProjectAlias(input);
    assert.equal(result.canonicalNode, null);
    assert.equal(result.unresolved, true);
  }
});
