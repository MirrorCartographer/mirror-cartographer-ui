# PermissionedViewRecord v0

Status labels

- Source status: derived from public-safe architecture synthesis and current external research on consent, provenance, and patient-managed records.
- Claim status: schema proposal; not production access control, clinical compliance, legal advice, or security certification.
- Privacy status: public-safe; contains no private case data.
- Missingness: no JSON schema, database migration, UI implementation, policy engine, threat model, or audit test yet.
- Revision reason: created to turn the permissioned care continuity concept into a reusable record shape.

## Purpose

A PermissionedViewRecord describes one generated view from a larger private continuity record.

It exists to prevent silent flattening.

The record must show what view was created, why it was created, who it was for, what it included, what it excluded, and how claims were bounded.

## Required fields

### identity

- `record_id`
- `parent_continuity_record_id`
- `view_id`
- `created_at`
- `created_by`
- `lifecycle_state`

### view purpose

- `view_type`
  - private_meaning
  - self_review
  - professional_handoff
  - team_accessible
  - public_safe_method
  - research_safe_aggregate
- `audience`
- `purpose`
- `time_range`
- `detail_level`
- `expiration_rule`

### consent and access

- `consent_status`
  - draft
  - previewed
  - approved
  - shared
  - revoked
  - expired
- `consent_basis`
- `access_scope`
- `revocation_path`
- `emergency_override_allowed`
- `audit_required`

### source and claim labels

- `source_status`
- `claim_status`
- `privacy_status`
- `missingness`
- `revision_reason`

### content boundary

- `included_fields`
- `excluded_fields`
- `compressed_fields`
- `translated_fields`
- `redacted_fields`
- `not_shared_fields`

### epistemic boundary

- `observations`
- `interpretations`
- `hypotheses`
- `questions`
- `unsupported_claims_removed`
- `professional_review_needed`

### transformation trace

- `original_view_summary`
- `generated_view_summary`
- `view_diff`
- `meaning_preserved`
- `meaning_lost_or_deferred`
- `privacy_reductions`
- `claim_downgrades`

### evaluation

- `readability_score`
- `professional_legibility_score`
- `privacy_minimization_score`
- `uncertainty_preservation_score`
- `source_labeling_score`
- `user_inspection_passed`
- `review_notes`

## Non-goals

This schema does not decide diagnosis, treatment, risk, urgency, eligibility, liability, or medical necessity.

It only describes the boundary conditions for a view.

## Failure modes

- A professional view includes private symbolism without explicit selection.
- A public-safe method view accidentally preserves identity traces.
- A research aggregate contains rare combinations that could re-identify someone.
- A summary removes uncertainty and becomes overconfident.
- `not shared` is visually confused with `deleted`.
- A team-access view expands because a person is curious rather than because they need access.

## Minimum viable implementation

The first implementation can be simple:

1. User selects audience.
2. User selects purpose.
3. System generates preview.
4. System shows ViewDiff.
5. User approves or edits.
6. System records source, claim, privacy, missingness, and revision labels.
7. System stores the generated view separately from the private record.

## Evaluation question

Can a non-expert inspect a PermissionedViewRecord and understand what changed between private meaning and shared communication?
