# ClaimBoundaryRecord v0

Status labels

- Source status: schema derived from public-safe MC research synthesis.
- Claim status: implementation plan / schema draft; not production privacy infrastructure.
- Privacy status: designed to prevent exposure of private material by storing categories and transformations rather than raw private content.
- Missingness: no runtime validator, no access-control layer, no encryption, no deletion/revocation workflow, no third-party compliance review.
- Revision reason: added after contradiction pass identified claim-boundary compilation as the missing layer between private expressive material and public artifacts.

## Purpose

A `ClaimBoundaryRecord` documents how an input was transformed into a safer output.

It should attach to public-safe MC artifacts, especially when private-context material influenced architecture but cannot be exposed.

## Fields

### identity

- record_id
- artifact_id
- created_at
- compiler_version
- target_view

### source boundary

- source_kind: `github_public`, `file_library_private`, `saved_context_private`, `chat_context_private`, `public_web`, `synthetic_demo`, `mixed`
- source_status_label
- source_confidence: `low`, `medium`, `high`
- private_material_used_for_architecture_only: boolean
- raw_source_exposed: boolean

### invariant meaning

- invariant_structure
- domain_lenses_used
- preserved_meaning_summary

### claim boundary

- allowed_claims
- forbidden_claims
- claim_strength: `metaphor`, `hypothesis`, `requirement`, `research_question`, `observed_repository_state`, `externally_supported_claim`, `validated_result`
- evidence_needed_to_upgrade_claim

### privacy boundary

- removed_categories
- generalized_categories
- sensitive_categories_detected
- identity_specificity_level: `none`, `project_name_only`, `public_author_name`, `private_identity_detail_removed`

### missingness boundary

- missing_evidence
- missing_implementation
- missing_evaluation
- missing_review

### revision boundary

- revision_reason
- changes_made
- meaning_loss_risk: `low`, `medium`, `high`
- overreach_risk_after_revision: `low`, `medium`, `high`

### next action

- next_allowed_test
- blocked_actions
- publication_status: `private_original`, `public_safe_translation`, `needs_review`, `blocked`

## Minimal JSON shape

{
  "record_id": "cbr-demo-001",
  "target_view": "public_product_view",
  "source_kind": "mixed",
  "private_material_used_for_architecture_only": true,
  "raw_source_exposed": false,
  "invariant_structure": "one meaning transformed across permissioned views",
  "claim_strength": "requirement",
  "allowed_claims": ["MC can structure public-safe transformations as a design requirement"],
  "forbidden_claims": ["MC is clinically validated", "MC guarantees safety"],
  "removed_categories": ["private transcript detail", "health detail", "household detail"],
  "missing_evidence": ["user testing", "privacy review", "runtime implementation"],
  "revision_reason": "public-safe abstraction required",
  "publication_status": "public_safe_translation"
}

## Evaluation use

A record passes v0 if a reviewer can answer:

1. What source category influenced the artifact?
2. What claim level is allowed?
3. What private categories were removed?
4. What is still missing?
5. Why does the public version differ from the original?
