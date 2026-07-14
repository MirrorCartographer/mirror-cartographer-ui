import assert from "node:assert/strict";
import { validateIdentifierOriginEvidence, RESOLUTION_RULE } from "./validate-identifier-origin-evidence.mjs";

const origin = {
  locator: "git:commit:abc123:path:operations/DECISIONS.md#L12",
  source_class: "git_object",
  immutable: true,
  explicit_identifier_assignment: true,
  namespace_agreement: true,
  owner_agreement: true,
  semantic_role_agreement: true,
  temporal_precedence: true,
  disposition: "accepted_origin"
};

function document(overrides = {}) {
  return {
    schema_version: 1,
    reported_identifier: "M-004",
    claim_status: "resolved",
    source_status: "immutable_verified",
    candidate_sources: [origin],
    resolution_rule: RESOLUTION_RULE,
    falsification_route: ["Disprove immutable locator or assignment semantics."],
    privacy_class: "public_repository_metadata",
    ...overrides
  };
}

function reject(name, value, expected) {
  const result = validateIdentifierOriginEvidence(value);
  assert.equal(result.valid, false, name);
  assert.ok(result.errors.some(error => error.includes(expected)), `${name}: ${result.errors.join(" | ")}`);
}

assert.deepEqual(validateIdentifierOriginEvidence(document()), { valid: true, errors: [] });

reject("semantic-only match", document({ candidate_sources: [{ ...origin, explicit_identifier_assignment: false, disposition: "supporting_context_only" }] }), "accepted immutable origin");
reject("suffix collision", document({ candidate_sources: [{ ...origin, explicit_identifier_assignment: false, namespace_agreement: false, disposition: "rejected_collision" }] }), "accepted immutable origin");
reject("late reference", document({ candidate_sources: [{ ...origin, temporal_precedence: false, disposition: "rejected_late_reference" }] }), "accepted immutable origin");
reject("mutable source", document({ candidate_sources: [{ ...origin, immutable: false, disposition: "lead_only" }] }), "accepted immutable origin");
reject("missing explicit assignment", document({ candidate_sources: [{ ...origin, explicit_identifier_assignment: false, disposition: "lead_only" }] }), "accepted immutable origin");
reject("accepted predicate mismatch", document({ candidate_sources: [{ ...origin, owner_agreement: false }] }), "cannot be accepted_origin");
reject("unlocated resolved claim", document({ source_status: "unlocated", candidate_sources: [] }), "resolved claims require source_status");
reject("verified but unresolved", document({ claim_status: "unresolved" }), "accepted immutable origin candidate requires claim_status=resolved");
reject("ambiguous double origin", document({ candidate_sources: [origin, { ...origin, locator: "git:commit:def456:path:operations/DECISIONS.md#L18" }] }), "multiple accepted origins");
reject("collision with explicit assignment", document({ claim_status: "unresolved", source_status: "collision_rejected", candidate_sources: [{ ...origin, disposition: "rejected_collision" }] }), "cannot be rejected_collision");
reject("late reference with precedence", document({ claim_status: "unresolved", source_status: "lead_only", candidate_sources: [{ ...origin, disposition: "rejected_late_reference" }] }), "cannot be rejected_late_reference");

console.log("identifier-origin validator: 12 assertions passed");
