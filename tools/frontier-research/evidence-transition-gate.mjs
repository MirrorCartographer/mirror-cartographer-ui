const ALLOWED_STATUS = new Set(['observed','inferred','proposed','superseded','unresolved']);
const ALLOWED_STRENGTH = new Set(['none','weak','moderate','strong']);
const STRENGTH_RANK = { none: 0, weak: 1, moderate: 2, strong: 3 };

export function evaluateEvidenceTransition(packet, now = new Date()) {
  const reasons = [];
  if (!packet || typeof packet !== 'object' || Array.isArray(packet)) {
    return { accepted: false, state: 'invalid', reasons: ['packet_not_object'] };
  }
  if (!ALLOWED_STATUS.has(packet.status)) reasons.push('invalid_status');
  if (!ALLOWED_STRENGTH.has(packet.evidence_strength)) reasons.push('invalid_evidence_strength');
  if (!Array.isArray(packet.sources) || packet.sources.length === 0) reasons.push('sources_required');
  if (!packet.falsification || typeof packet.falsification.test !== 'string' || !packet.falsification.test.trim()) {
    reasons.push('falsification_test_required');
  }
  if (!packet.provenance || typeof packet.provenance.generated_at !== 'string') {
    reasons.push('provenance_generated_at_required');
  }

  const generated = packet?.provenance?.generated_at ? new Date(packet.provenance.generated_at) : null;
  if (generated && Number.isNaN(generated.getTime())) reasons.push('invalid_generated_at');
  if (generated && generated.getTime() > now.getTime()) reasons.push('future_dated');

  if (packet.status === 'observed' && STRENGTH_RANK[packet.evidence_strength] < STRENGTH_RANK.moderate) {
    reasons.push('observed_requires_moderate_evidence');
  }
  if (packet.status === 'inferred' && (!Array.isArray(packet.based_on) || packet.based_on.length === 0)) {
    reasons.push('inference_requires_parent_claims');
  }
  if (packet.status === 'superseded' && typeof packet.superseded_by !== 'string') {
    reasons.push('superseded_by_required');
  }

  return {
    accepted: reasons.length === 0,
    state: reasons.length === 0 ? 'accepted' : 'rejected',
    reasons
  };
}
