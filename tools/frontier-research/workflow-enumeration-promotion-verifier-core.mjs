import { createHash } from 'node:crypto';

function sha256Utf8(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])])
    );
  }
  return value;
}

function sameJson(left, right) {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

export function verifyPromotionArtifactBinding({ sourceText, artifact, reassessed }) {
  if (typeof sourceText !== 'string') throw new Error('source_text_required');
  if (!artifact || artifact.schema_version !== 2) {
    return { verified: false, reason: 'artifact_schema_unsupported', evidence_strength: 'invalid_retained_artifact' };
  }
  if (artifact.artifact_type !== 'workflow_enumeration_promotion_assessment') {
    return { verified: false, reason: 'artifact_type_invalid', evidence_strength: 'invalid_retained_artifact' };
  }
  if (artifact.source?.media_type !== 'application/json') {
    return { verified: false, reason: 'source_media_type_invalid', evidence_strength: 'invalid_retained_artifact' };
  }

  const expectedByteLength = Buffer.byteLength(sourceText, 'utf8');
  if (artifact.source.byte_length !== expectedByteLength) {
    return { verified: false, reason: 'source_byte_length_mismatch', evidence_strength: 'source_binding_failed' };
  }

  const expectedSha256 = sha256Utf8(sourceText);
  if (artifact.source.sha256 !== expectedSha256) {
    return { verified: false, reason: 'source_sha256_mismatch', evidence_strength: 'source_binding_failed' };
  }

  if (!artifact.assessment || !reassessed) {
    return { verified: false, reason: 'assessment_missing', evidence_strength: 'assessment_revalidation_failed' };
  }
  if (!sameJson(artifact.assessment, reassessed)) {
    return { verified: false, reason: 'assessment_drift', evidence_strength: 'assessment_revalidation_failed' };
  }

  return {
    verified: true,
    reason: 'source_and_assessment_revalidated',
    evidence_strength: 'source_bound_freshly_reassessed_promotion_artifact',
    source_sha256: expectedSha256,
    source_byte_length: expectedByteLength,
    promotable: reassessed.promotable === true
  };
}
