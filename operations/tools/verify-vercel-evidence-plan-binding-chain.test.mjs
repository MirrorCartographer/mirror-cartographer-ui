import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyVercelEvidencePlanBinding } from './verify-vercel-evidence-plan-binding-chain.mjs';

const A = 'a'.repeat(64);
const B = 'b'.repeat(64);
const record = (digest = A) => ({ plan_binding: { algorithm: 'sha256', digest } });

test('accepts a matching plan-binding chain', () => {
  const result = verifyVercelEvidencePlanBinding({
    validated_plan: record(),
    raw_manifest: record(),
    reconciliation_bundle: record(),
  });
  assert.equal(result.ok, true);
  assert.equal(result.evidence_promotable, true);
  assert.equal(result.plan_binding.digest, A);
});

test('rejects a missing raw-manifest binding', () => {
  const result = verifyVercelEvidencePlanBinding({
    validated_plan: record(),
    raw_manifest: {},
    reconciliation_bundle: record(),
  });
  assert.equal(result.reason, 'raw_manifest_plan_binding_missing');
  assert.equal(result.evidence_promotable, false);
});

test('rejects a raw-manifest digest mismatch', () => {
  const result = verifyVercelEvidencePlanBinding({
    validated_plan: record(),
    raw_manifest: record(B),
    reconciliation_bundle: record(),
  });
  assert.equal(result.reason, 'raw_manifest_plan_binding_mismatch');
});

test('rejects a reconciliation-bundle digest mismatch', () => {
  const result = verifyVercelEvidencePlanBinding({
    validated_plan: record(),
    raw_manifest: record(),
    reconciliation_bundle: record(B),
  });
  assert.equal(result.reason, 'reconciliation_bundle_plan_binding_mismatch');
});

test('rejects a malformed validated-plan digest', () => {
  const result = verifyVercelEvidencePlanBinding({
    validated_plan: record('x'),
    raw_manifest: record(),
    reconciliation_bundle: record(),
  });
  assert.equal(result.reason, 'validated_plan_digest_invalid');
});
