# DualViewConsentRecord v0

Status labels

- Source status: derived from existing MC context routing, care communication, provenance card, and privacy boundary artifacts.
- Claim status: schema proposal, not implemented software or legal/privacy compliance guarantee.
- Privacy status: public-safe abstraction.
- Missingness: no database schema, permissions system, audit log, UI, encryption design, clinician review, veterinary review, or compliance review completed.
- Revision reason: created to specify how one underlying private state can generate multiple consent-bounded views without exposing raw context.

## Purpose

`DualViewConsentRecord` defines how a private MC state object can generate a professional or public-safe derivative while preserving source, claim, privacy, missingness, and revision boundaries.

## Required fields

### identity

- record_id
- created_at
- updated_at
- lifecycle_state
- parent_private_record_id
- derivative_view_id

### source_boundary

- source_status
- source_types_used
- source_types_excluded
- raw_context_available_private_only
- source_confidence
- source_gaps

### consent_boundary

- owner
- intended_recipient_type
- intended_use
- allowed_time_range
- allowed_detail_level
- explicitly_included_fields
- explicitly_excluded_fields
- consent_timestamp
- expiration_or_review_date
- revocation_note

### claim_boundary

- allowed_claim_strength
- blocked_claims
- diagnostic_boundary
- treatment_boundary
- urgency_boundary
- uncertainty_statement

### privacy_boundary

- privacy_status
- identifiers_removed
- sensitive_context_removed
- private_symbols_removed_or_translated
- household_context_removed
- location_context_removed
- relationship_context_removed
- financial_context_removed
- credential_context_removed
- raw_transcript_removed

### transformation_trace

For each transformed item:

- private_input_type
- public_or_professional_output_field
- transformation_type
- reason_for_transformation
- meaning_preserved
- meaning_removed
- risk_reduced
- uncertainty_added

### professional_handoff_fields

- reason_for_summary
- observations
- timeline
- recurrence
- functional_impact
- changes_over_time
- current_unknowns
- questions_for_professional
- attachments_or_photos_available
- what_this_summary_cannot_prove

### evaluation

- clarity_score
- brevity_score
- uncertainty_preservation_score
- privacy_minimization_score
- professional_legibility_score
- overclaim_risk_score
- next_revision

## Minimal markdown export

Title:

Purpose:

Recipient type:

Time range:

Observations:

Timeline:

Functional impact:

Uncertainty:

Questions:

What this cannot prove:

Source status:

Claim status:

Privacy status:

Missingness:

Revision reason:

## Hard boundaries

This schema must not be used to produce:

- diagnosis
- triage
- treatment recommendation
- medication decision
- emergency assessment
- legal compliance guarantee
- proof that private symbolic material has biological causation

## First implementation test

Create one fictional private note and generate:

1. a private symbolic reflection view
2. a professional handoff view
3. a transformation trace comparing the two

The test passes only if the professional handoff view remains useful after all private symbolic and identifying material is removed.
