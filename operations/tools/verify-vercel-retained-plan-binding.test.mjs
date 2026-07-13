import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyVercelRetainedPlanBinding } from './verify-vercel-retained-plan-binding.mjs';

const A = 'a'.repeat(64);
const B = 'b'.repeat(64);
const approvedPlan = { plan_binding_created: true, plan_binding: { algorithm: 'sha256', digest: A } };
const manifest = { plan_binding: { algorithm: 'sha256', digest: A } };
const bundle = { plan_binding: { algorithm: 'sha256', digest: A } };

test('accepts three-way agreement', () => {
  const result = verifyVercelRetainedPlanBinding({ approvedPlan, retainedManifest: manifest, reconciliationBundle: bundle });
  assert.equal(result.verified, true);
  assert.equal(result.promotion_allowed, true);
  assert.deepEqual(result.reasons, []);
});

test('fails closed when a retained digest is missing', () => {
  const result = verifyVercelRetainedPlanBinding({ approvedPlan, retainedManifest: {}, reconciliationBundle: bundle });
  assert.equal(result.verified, false);
  assert.ok(result.reasons.includes('retained_manifest_digest_invalid'));
});

test('rejects a manifest mismatch', () => {
  const result = verifyVercelRetainedPlanBinding({ approvedPlan, retainedManifest: { plan_binding: { algorithm: 'sha256', digest: B } }, reconciliationBundle: bundle });
  assert.equal(result.verified, false);
  assert.ok(result.reasons.includes('retained_manifest_digest_mismatch'));
  assert.ok(result.reasons.includes('retained_records_disagree'));
});

test('rejects an unbound approved plan', () => {
  const result = verifyVercelRetainedPlanBinding({ approvedPlan: { plan_binding_created: false }, retainedManifest: manifest, reconciliationBundle: bundle });
  assert.equal(result.verified, false);
  assert.ok(result.reasons.includes('approved_plan_not_bound'));
  assert.ok(result.reasons.includes('approved_plan_digest_invalid'));
});
