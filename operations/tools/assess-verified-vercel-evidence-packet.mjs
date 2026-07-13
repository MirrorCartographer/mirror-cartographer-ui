import { readVerifiedVercelEvidencePacket } from './read-vercel-evidence-packet.mjs';
import { assessVercelCommitStatus } from './vercel-commit-status-assessment.mjs';

export async function assessVerifiedVercelEvidencePacket({
  marker_path,
  observed_at,
  statuses,
  read_packet = readVerifiedVercelEvidencePacket,
  assess_status = assessVercelCommitStatus
} = {}) {
  if (typeof read_packet !== 'function') throw new TypeError('read_packet_must_be_function');
  if (typeof assess_status !== 'function') throw new TypeError('assess_status_must_be_function');

  const packet = await read_packet({ marker_path });
  if (!packet?.verified || !packet?.coherence_verified) {
    throw new Error('verified_coherent_packet_required');
  }

  const assessment = assess_status({
    repository: packet.repository,
    commit_sha: packet.source_commit_sha,
    observed_at,
    statuses
  });

  if (!assessment?.accepted) {
    return Object.freeze({
      ...assessment,
      packet_verified: true,
      packet_coherence_verified: true,
      packet_id: packet.packet_id,
      deployment_claim_permitted: false
    });
  }

  const identityMatches = assessment.repository === packet.repository
    && assessment.commit_sha === packet.source_commit_sha;

  if (!identityMatches) {
    throw new Error('assessment_packet_identity_mismatch');
  }

  return Object.freeze({
    ...assessment,
    packet_verified: true,
    packet_coherence_verified: true,
    packet_id: packet.packet_id,
    packet_claim_ceiling: packet.claim_ceiling,
    deployment_claim_permitted: Boolean(
      assessment.deployable
      && assessment.deployment_identity_verified
      && packet.deployment_claim_permitted
    )
  });
}
