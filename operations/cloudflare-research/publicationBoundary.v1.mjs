const ALLOWED_AUDIENCES = new Set(['public', 'professional']);
const ALLOWED_PRIVACY = new Set(['public']);
const ALLOWED_CLAIM_TYPES = new Set([
  'research_summary',
  'design_hypothesis',
  'evidence_method',
  'infrastructure_status'
]);
const ALLOWED_EVIDENCE_STATES = new Set(['observed', 'inferred', 'proposed']);
const FORBIDDEN_MEDICAL_TYPES = new Set(['diagnosis', 'treatment_recommendation', 'clinical_decision']);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validSource(source) {
  return source &&
    isNonEmptyString(source.locator) &&
    ['primary', 'secondary', 'repository'].includes(source.source_status) &&
    isNonEmptyString(source.accessed_at);
}

export function assessPublicationPacket(packet) {
  const reasons = [];

  if (!packet || typeof packet !== 'object' || Array.isArray(packet)) {
    return { publishable: false, reasons: ['packet_invalid'], evidence_strength: 'none' };
  }

  if (packet.schema_version !== 1) reasons.push('schema_version_unsupported');
  if (!isNonEmptyString(packet.packet_id)) reasons.push('packet_id_missing');
  if (!ALLOWED_AUDIENCES.has(packet.audience)) reasons.push('audience_not_publication_safe');
  if (!ALLOWED_PRIVACY.has(packet.privacy_class)) reasons.push('privacy_class_not_public');

  if (FORBIDDEN_MEDICAL_TYPES.has(packet.claim_type)) {
    reasons.push('medical_claim_forbidden');
  } else if (!ALLOWED_CLAIM_TYPES.has(packet.claim_type)) {
    reasons.push('claim_type_not_allowed');
  }

  if (!ALLOWED_EVIDENCE_STATES.has(packet.evidence_state)) {
    reasons.push('evidence_state_not_publishable');
  }

  if (packet.contains_personal_identifiers !== false) {
    reasons.push('personal_identifier_boundary_unproven');
  }

  if (!Array.isArray(packet.sources) || packet.sources.length === 0) {
    reasons.push('sources_missing');
  } else if (!packet.sources.every(validSource)) {
    reasons.push('source_record_invalid');
  }

  if (['inferred', 'proposed'].includes(packet.evidence_state) && !isNonEmptyString(packet.uncertainty_statement)) {
    reasons.push('uncertainty_statement_required');
  }

  if (!isNonEmptyString(packet.falsification_route)) {
    reasons.push('falsification_route_required');
  }

  const sourceStatuses = Array.isArray(packet.sources)
    ? packet.sources.filter(validSource).map((source) => source.source_status)
    : [];
  const evidenceStrength = sourceStatuses.includes('primary')
    ? 'primary_source_supported'
    : sourceStatuses.length > 0
      ? 'bounded_non_primary'
      : 'none';

  return {
    publishable: reasons.length === 0,
    reasons,
    evidence_strength: evidenceStrength
  };
}
