import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVerifiedConfusablesDataset } from './build-verified-confusables-dataset.mjs';

const encoder = new TextEncoder();
const validText = `# Unicode Security Mechanisms for UTS #39
# Version: 17.0.0
0041 ; 0061 ; MA
0391 ; 0061 ; MA
`;
const canonicalMappings = ['0041;0061;MA', '0391;0061;MA'];

function verifiedSource(events = []) {
  return (bytes, context) => {
    events.push('source');
    assert.ok(bytes instanceof Uint8Array);
    assert.equal(context.expectedVersion, '17.0.0');
    assert.match(context.sourceSha256, /^[0-9a-f]{64}$/u);
    return { verified: true, verifier: 'test-pinned-source' };
  };
}

function canonicalParser(events = []) {
  return (_text, context) => {
    events.push('parser');
    assert.equal(context.semanticEvidence.recordCount, 2);
    return {
      canonicalMappings,
      dataset: new Map([
        [0x41, [0x61]],
        [0x391, [0x61]]
      ])
    };
  };
}

test('authenticates bytes before parsing and returns a bound promotion envelope', () => {
  const events = [];
  const result = buildVerifiedConfusablesDataset({
    sourceBytes: encoder.encode(validText),
    expectedVersion: '17.0.0',
    sourceVerifier: verifiedSource(events),
    parser: canonicalParser(events)
  });

  assert.deepEqual(events, ['source', 'parser']);
  assert.equal(result.verified, true);
  assert.equal(result.claim, 'construction_boundary_only');
  assert.equal(result.recordCount, 2);
  assert.match(result.sourceSha256, /^[0-9a-f]{64}$/u);
  assert.match(result.canonicalSha256, /^[0-9a-f]{64}$/u);
  assert.equal(result.sourceEvidence.verifier, 'test-pinned-source');
  assert.ok(result.dataset instanceof Map);
  assert.ok(Object.isFrozen(result));
});

test('rejects source evidence that is not verified and never calls parser', () => {
  let parserCalled = false;
  assert.throws(
    () => buildVerifiedConfusablesDataset({
      sourceBytes: encoder.encode(validText),
      expectedVersion: '17.0.0',
      sourceVerifier: () => ({ verified: false }),
      parser: () => {
        parserCalled = true;
        return {};
      }
    }),
    { code: 'ERR_CONFUSABLES_SOURCE_UNVERIFIED' }
  );
  assert.equal(parserCalled, false);
});

test('rejects malformed semantics before parser invocation', () => {
  let parserCalled = false;
  const malformed = validText.replace('; MA', '; SL');
  assert.throws(
    () => buildVerifiedConfusablesDataset({
      sourceBytes: encoder.encode(malformed),
      expectedVersion: '17.0.0',
      sourceVerifier: verifiedSource(),
      parser: () => {
        parserCalled = true;
        return {};
      }
    }),
    { code: 'ERR_CONFUSABLES_MAPPING_TYPE' }
  );
  assert.equal(parserCalled, false);
});

test('rejects parser record-count divergence', () => {
  assert.throws(
    () => buildVerifiedConfusablesDataset({
      sourceBytes: encoder.encode(validText),
      expectedVersion: '17.0.0',
      sourceVerifier: verifiedSource(),
      parser: () => ({ canonicalMappings: canonicalMappings.slice(0, 1), dataset: {} })
    }),
    { code: 'ERR_CONFUSABLES_RECORD_COUNT_MISMATCH' }
  );
});

test('rejects parser canonical-digest divergence', () => {
  assert.throws(
    () => buildVerifiedConfusablesDataset({
      sourceBytes: encoder.encode(validText),
      expectedVersion: '17.0.0',
      sourceVerifier: verifiedSource(),
      parser: () => ({
        canonicalMappings: ['0041;0062;MA', '0391;0061;MA'],
        dataset: {}
      })
    }),
    { code: 'ERR_CONFUSABLES_CANONICAL_DIGEST_MISMATCH' }
  );
});

test('rejects invalid UTF-8 after byte authentication and before parsing', () => {
  let parserCalled = false;
  assert.throws(
    () => buildVerifiedConfusablesDataset({
      sourceBytes: Uint8Array.from([0xc3, 0x28]),
      expectedVersion: '17.0.0',
      sourceVerifier: verifiedSource(),
      parser: () => {
        parserCalled = true;
        return {};
      }
    }),
    { code: 'ERR_CONFUSABLES_UTF8' }
  );
  assert.equal(parserCalled, false);
});
