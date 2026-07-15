import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVerifiedConfusablesDataset } from './build-verified-confusables-dataset.mjs';

const encoder = new TextEncoder();
const validText = `# Unicode Security Mechanisms for UTS #39
# Version: 17.0.0
0041 ; 0061 ; MA
0391 ; 0061 ; MA
`;

function verifiedSource() {
  return { verified: true, verifier: 'test-pinned-source' };
}

test('uses the repository canonical parser when parser is omitted', () => {
  const result = buildVerifiedConfusablesDataset({
    sourceBytes: encoder.encode(validText),
    expectedVersion: '17.0.0',
    sourceVerifier: verifiedSource
  });

  assert.equal(result.verified, true);
  assert.equal(result.parserIdentity, 'repository_canonical_v1');
  assert.equal(result.recordCount, 2);
  assert.ok(result.dataset instanceof Map);
  assert.deepEqual(result.dataset.get(0x41), [0x61]);
});

test('labels an injected parser as independent', () => {
  const result = buildVerifiedConfusablesDataset({
    sourceBytes: encoder.encode(validText),
    expectedVersion: '17.0.0',
    sourceVerifier: verifiedSource,
    parser: () => ({
      canonicalMappings: ['0041;0061;MA', '0391;0061;MA'],
      dataset: new Map()
    })
  });

  assert.equal(result.parserIdentity, 'injected_independent');
});
