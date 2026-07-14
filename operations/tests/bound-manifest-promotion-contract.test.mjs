import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sourceUrl = new URL('../tools/write-bound-vercel-authenticated-evidence-manifest.mjs', import.meta.url);
const source = await readFile(sourceUrl, 'utf8');

test('bound manifest writer imports the ordered evidence promotion gate', () => {
  assert.ok(source.includes("import { validateEvidencePromotion } from '../../tools/frontier-research/evidence-promotion-gate.mjs';"));
});

test('promotion validation occurs before manifest writing and fails closed', () => {
  const promotionCall = source.indexOf('await validateEvidencePromotion(input, { cwd: evidence_root })');
  const promotionReject = source.indexOf('if (!promotion.verified) return promotion;');
  const manifestWrite = source.indexOf('await writeAuthenticatedEvidenceManifest({ input_path, output_path })');
  assert.ok(promotionCall >= 0);
  assert.ok(promotionReject > promotionCall);
  assert.ok(manifestWrite > promotionReject);
});

test('legacy partial-gate bypasses are removed', () => {
  assert.equal(source.includes('verifyRetainedRawOutputBinding'), false);
  assert.equal(source.includes('verifyIndependentExecutionProvenance'), false);
});

test('successful result retains the complete promotion evidence', () => {
  assert.ok(source.includes("reason: 'promoted_authenticated_evidence_manifest_written'"));
  assert.ok(source.includes('evidence_promotion: promotion'));
});
