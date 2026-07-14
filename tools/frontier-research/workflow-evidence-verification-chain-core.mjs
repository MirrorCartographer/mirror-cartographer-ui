import { verifyWorkflowEvidenceRetentionManifest } from './workflow-evidence-retention-manifest-core.mjs';
import { verifyWorkflowEvidenceSemanticBinding } from './workflow-evidence-semantic-binding-core.mjs';

function fail(stage, result) {
  return {
    verified: false,
    stage,
    reason: result?.reason ?? `${stage}_failed_without_reason`,
    evidence_strength: result?.evidence_strength ?? `${stage}_failed`,
    byte_verification: stage === 'byte_retention' ? result : undefined,
    semantic_verification: stage === 'semantic_binding' ? result : undefined
  };
}

export function verifyWorkflowEvidenceChain({ manifest, retainedArtifacts }) {
  const byteVerification = verifyWorkflowEvidenceRetentionManifest({ manifest, retainedArtifacts });
  if (!byteVerification.verified) return fail('byte_retention', byteVerification);

  const semanticVerification = verifyWorkflowEvidenceSemanticBinding({
    manifest,
    retainedArtifacts,
    byteVerification
  });
  if (!semanticVerification.verified) {
    return {
      ...fail('semantic_binding', semanticVerification),
      byte_verification: byteVerification
    };
  }

  if (byteVerification.commit_sha !== semanticVerification.commit_sha) {
    return {
      verified: false,
      stage: 'chain_consistency',
      reason: 'verification_stage_commit_mismatch',
      evidence_strength: 'verification_chain_inconsistent',
      byte_verification: byteVerification,
      semantic_verification: semanticVerification
    };
  }

  return {
    verified: true,
    stage: 'complete',
    reason: 'retained_evidence_byte_and_semantic_chain_verified',
    evidence_strength: 'byte_bound_complete_exact_commit_retention_plus_semantic_role_binding',
    commit_sha: byteVerification.commit_sha,
    byte_verification: byteVerification,
    semantic_verification: semanticVerification
  };
}
