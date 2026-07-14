const RESOLUTION_RULE = "resolved requires at least one immutable candidate with explicit_identifier_assignment=true, namespace_agreement=true, owner_agreement=true, semantic_role_agreement=true, temporal_precedence=true, and disposition=accepted_origin";

const CLAIM_STATUSES = new Set(["observed", "inferred", "proposed", "superseded", "unresolved", "resolved"]);
const SOURCE_STATUSES = new Set(["immutable_verified", "mutable_lead", "lead_only", "collision_rejected", "unlocated"]);
const SOURCE_CLASSES = new Set(["git_object", "decision_log", "language_lexicon", "project_document", "chat_history", "automation_output", "file_library", "other"]);
const DISPOSITIONS = new Set(["accepted_origin", "supporting_context_only", "lead_only", "rejected_collision", "rejected_late_reference"]);
const PRIVACY_CLASSES = new Set(["public_repository_metadata", "private_source_redacted", "private_source_locator_only"]);
const IDENTIFIER_PATTERN = /^[A-Z][A-Z0-9-]*-[0-9]{3,}$/;

function isAcceptedOrigin(candidate) {
  return candidate.immutable === true &&
    candidate.explicit_identifier_assignment === true &&
    candidate.namespace_agreement === true &&
    candidate.owner_agreement === true &&
    candidate.semantic_role_agreement === true &&
    candidate.temporal_precedence === true &&
    candidate.disposition === "accepted_origin";
}

function validateCandidate(candidate, index, errors) {
  const path = `candidate_sources[${index}]`;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    errors.push(`${path} must be an object`);
    return;
  }
  const allowed = new Set(["locator", "source_class", "immutable", "explicit_identifier_assignment", "namespace_agreement", "owner_agreement", "semantic_role_agreement", "temporal_precedence", "disposition"]);
  for (const key of Object.keys(candidate)) if (!allowed.has(key)) errors.push(`${path}.${key} is not allowed`);
  if (typeof candidate.locator !== "string" || candidate.locator.length === 0) errors.push(`${path}.locator must be a non-empty string`);
  if (!SOURCE_CLASSES.has(candidate.source_class)) errors.push(`${path}.source_class is invalid`);
  for (const key of ["immutable", "explicit_identifier_assignment", "namespace_agreement", "owner_agreement", "semantic_role_agreement", "temporal_precedence"]) {
    if (typeof candidate[key] !== "boolean") errors.push(`${path}.${key} must be boolean`);
  }
  if (!DISPOSITIONS.has(candidate.disposition)) errors.push(`${path}.disposition is invalid`);

  if (candidate.disposition === "accepted_origin" && !isAcceptedOrigin(candidate)) {
    errors.push(`${path} cannot be accepted_origin unless every origin predicate is true`);
  }
  if (candidate.disposition === "rejected_collision" && candidate.explicit_identifier_assignment === true) {
    errors.push(`${path} cannot be rejected_collision when it explicitly assigns the identifier`);
  }
  if (candidate.disposition === "rejected_late_reference" && candidate.temporal_precedence === true) {
    errors.push(`${path} cannot be rejected_late_reference when temporal_precedence is true`);
  }
}

export function validateIdentifierOriginEvidence(document) {
  const errors = [];
  if (!document || typeof document !== "object" || Array.isArray(document)) return { valid: false, errors: ["document must be an object"] };

  const allowed = new Set(["schema_version", "reported_identifier", "claim_status", "source_status", "candidate_sources", "resolution_rule", "falsification_route", "privacy_class"]);
  for (const key of Object.keys(document)) if (!allowed.has(key)) errors.push(`${key} is not allowed`);
  if (document.schema_version !== 1) errors.push("schema_version must equal 1");
  if (typeof document.reported_identifier !== "string" || !IDENTIFIER_PATTERN.test(document.reported_identifier)) errors.push("reported_identifier has invalid format");
  if (!CLAIM_STATUSES.has(document.claim_status)) errors.push("claim_status is invalid");
  if (!SOURCE_STATUSES.has(document.source_status)) errors.push("source_status is invalid");
  if (!Array.isArray(document.candidate_sources)) errors.push("candidate_sources must be an array");
  else document.candidate_sources.forEach((candidate, index) => validateCandidate(candidate, index, errors));
  if (document.resolution_rule !== RESOLUTION_RULE) errors.push("resolution_rule does not match the canonical rule");
  if (!Array.isArray(document.falsification_route) || document.falsification_route.length === 0 || document.falsification_route.some(item => typeof item !== "string" || item.length === 0)) errors.push("falsification_route must contain at least one non-empty string");
  if (!PRIVACY_CLASSES.has(document.privacy_class)) errors.push("privacy_class is invalid");

  const candidates = Array.isArray(document.candidate_sources) ? document.candidate_sources : [];
  const accepted = candidates.filter(isAcceptedOrigin);
  if (document.claim_status === "resolved") {
    if (document.source_status !== "immutable_verified") errors.push("resolved claims require source_status=immutable_verified");
    if (accepted.length === 0) errors.push("resolved claims require an accepted immutable origin candidate");
  }
  if (document.source_status === "immutable_verified" && accepted.length === 0) errors.push("immutable_verified requires an accepted immutable origin candidate");
  if (accepted.length > 0 && document.claim_status !== "resolved") errors.push("an accepted immutable origin candidate requires claim_status=resolved");
  if (accepted.length > 1) errors.push("multiple accepted origins are ambiguous and fail closed");
  if (document.source_status === "unlocated" && document.claim_status !== "unresolved") errors.push("unlocated sources require claim_status=unresolved");
  if (document.claim_status === "unresolved" && document.source_status === "immutable_verified") errors.push("unresolved claims cannot use source_status=immutable_verified");

  return { valid: errors.length === 0, errors };
}

export { RESOLUTION_RULE };
