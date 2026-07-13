import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyRetainedOutputDigests } from './verify-retained-output-digests.mjs';

const A = 'a'.repeat(64);
const B = 'b'.repeat(64);
const C = 'c'.repeat(64);

function record(entries) { return { retained_outputs: entries }; }

test('accepts identical path-bound digest sets regardless of order', () => {
  const result = verifyRetainedOutputDigests({
    raw_manifest: record([{ path: 'primary.json', sha256: A }, { path: 'gh-pages.json', sha256: B }]),
    reconciliation_bundle: record([{ path: 'gh-pages.json', sha256: B }, { path: 'primary.json', sha256: A }]),
  });
  assert.equal(result.ok, true);
  assert.equal(result.retained_outputs.length, 2);
});

test('rejects digest mutation', () => {
  const result = verifyRetainedOutputDigests({
    raw_manifest: record([{ path: 'primary.json', sha256: A }]),
    reconciliation_bundle: record([{ path: 'primary.json', sha256: C }]),
  });
  assert.equal(result.reason, 'retained_output_digest_mismatch');
  assert.equal(result.evidence_promotable, false);
});

test('rejects missing path', () => {
  const result = verifyRetainedOutputDigests({
    raw_manifest: record([{ path: 'primary.json', sha256: A }]),
    reconciliation_bundle: record([{ path: 'other.json', sha256: A }]),
  });
  assert.equal(result.reason, 'retained_output_path_mismatch');
});

test('rejects duplicate manifest paths', () => {
  const result = verifyRetainedOutputDigests({
    raw_manifest: record([{ path: 'primary.json', sha256: A }, { path: 'primary.json', sha256: B }]),
    reconciliation_bundle: record([{ path: 'primary.json', sha256: A }]),
  });
  assert.equal(result.reason, 'raw_manifest_retained_outputs_duplicate_path');
});

test('rejects empty retained-output sets', () => {
  const result = verifyRetainedOutputDigests({ raw_manifest: record([]), reconciliation_bundle: record([]) });
  assert.equal(result.reason, 'raw_manifest_retained_outputs_missing');
});
