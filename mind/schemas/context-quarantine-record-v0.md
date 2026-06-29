# ContextQuarantineRecord v0

Source status: Newly generated schema from public-safe MC architecture research.
Claim status: Implementation plan / schema proposal.
Privacy status: Public-safe; contains no raw private examples.
Missingness: Not validated against a running MC backend in this run.
Revision reason: Adds an explicit staging record for context that is retrieved but not yet admissible.

## Purpose

ContextQuarantineRecord prevents retrieved context from silently entering generation before it is classified for privacy, temporal validity, source boundary, and claim transport.

## Fields

- record_id: stable identifier for the quarantine decision.
- run_id: non-identifying run reference.
- created_at: ISO-8601 timestamp.
- source_boundary_class: public_source | private_context | file_library_excerpt | repo_material | prior_generated_artifact | unknown_source.
- retrieval_reason: why the context was retrieved.
- relevance_score_band: high | medium | low | unknown.
- clearance_status: admitted | quarantined | abstract_only | rejected.
- privacy_status: public_safe | abstract_only | private_do_not_publish | sensitive_do_not_use | needs_manual_review.
- claim_status_allowed: cited_fact | architecture_inference | design_hypothesis | evaluation_requirement | open_question | none.
- temporal_status: current | historical | superseded | contested | unknown_age.
- missingness_status: complete_for_scope | partial_source_access | source_not_loaded | repo_index_unavailable | evidence_gap.
- allowed_use: direct_citation | abstract_method_design | missingness_note | research_question_only | no_use.
- forbidden_use: raw_excerpt | identifying_example | domain_transfer_as_proof | public_claim | model_persona_inference.
- revision_reason: why this decision changes or refines a prior artifact.
- release_note: public-safe sentence describing the boundary without exposing protected content.

## Decision rule

If privacy_status is private_do_not_publish, sensitive_do_not_use, or needs_manual_review, allowed_use cannot be direct_citation.

If temporal_status is superseded, contested, or unknown_age, claim_status_allowed cannot be cited_fact unless a current corroborating public source is added.

If source_boundary_class is private_context, public output may only include abstract_method_design, missingness_note, or research_question_only.

## Minimal public release note template

A relevant context source was withheld from direct use because its clearance status did not permit public wording. Only a non-identifying architecture requirement was retained.
