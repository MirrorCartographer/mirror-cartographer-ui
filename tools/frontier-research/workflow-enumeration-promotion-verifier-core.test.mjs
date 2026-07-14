import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { verifyPromotionArtifactBinding } from './workflow-enumeration-promotion-verifier-core.mjs';

const sourceText = '{\n  "schema_version": 1\n}\n';
const assessment = { promotable: false, reason: 'fixture', nested: { b: 2, a: 1 } };
const source = {
  media_type: 'application/json',
  byte_length: Buffer.byteLength(sourceText, 'utf8'),
  sha256: createHash('sha256').update(sourceText, 'utf8').digest('hex')
};
const artifact = {
  schema_version: 2,
  artifact_type: 'workflow_enumeration_promotion_assessment',
  source,
  assessment
};

test('accepts exact source bytes and semantically identical fresh assessment', () => {
  const result = verifyPromotionArtifactBinding({
    sourceText,
    artifact,
    reassessed: { nested: { a: 1, b: 2 }, reason: 'fixture', promotable: false }
  });
  assert.equal(result.verified, true);
  assert.equal(result.promotable, false);
  assert.equal(result.reason, 'source_and_assessment_revalidated');
});

test('rejects byte-length drift', () => {
  const result = verifyPromotionArtifactBinding({ sourceText: `${sourceText} `, artifact, reassessed: assessment });
  assert.equal(result.verified, false);
  assert.equal(result.reason, 'source_byte_length_mismatch');
});

test('rejects same-length source mutation by sha256', () => {
  const mutated = sourceText.replace('1', '2');
  const result = verifyPromotionArtifactBinding({ sourceText: mutated, artifact, reassessed: assessment });
  assert.equal(result.verified, false);
  assert.equal(result.reason, 'source_sha256_mismatch');
});

test('rejects fresh assessment drift', () => {
  const result = verifyPromotionArtifactBinding({
    sourceText,
    artifact,
    reassessed: { promotable: true, reason: 'changed', nested: { a: 1, b: 2 } }
  });
  assert.equal(result.verified, false);
  assert.equal(result.reason, 'assessment_drift');
});

test('rejects unsupported retained artifact schema', () => {
  const result = verifyPromotionArtifactBinding({
    sourceText,
    artifact: { ...artifact, schema_version: 1 },
    reassessed: assessment
  });
  assert.equal(result.verified, false);
  assert.equal(result.reason, 'artifact_schema_unsupported');
});
