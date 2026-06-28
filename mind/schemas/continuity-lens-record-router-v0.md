# ContinuityLensRecordRouter v0

Status labels

- Source status: derived from current MC repository architecture and public-safe synthesis.
- Claim status: implementation schema draft; not validated software, medical advice, veterinary advice, or legal guidance.
- Privacy status: public-safe abstraction.
- Missingness: no permissions engine, encryption model, access revocation model, audit UI, or consent workflow implemented.
- Revision reason: added to convert the private/professional/research split into a reusable MC schema.

## Purpose

Route one underlying meaning record into audience-appropriate views while preserving provenance and boundaries.

## Required fields

### record_id

Stable internal identifier.

### invariant_structure

The underlying relationship being preserved.

Example:

`recurrent observation with uncertain interpretation and functional impact`

### source_boundary

Allowed values:

- private_user_context
- user_supplied_record
- professional_record
- public_research
- generated_summary
- mixed_with_boundaries

### claim_boundary

Allowed values:

- observation
- interpretation
- hypothesis
- question
- product_requirement
- research_question
- evaluation_result
- not_allowed_to_claim

### privacy_boundary

Allowed values:

- private_only
- explicitly_shareable
- care_team_accessible
- professional_handoff
- public_safe_method
- research_safe_aggregate

### missingness_boundary

Required note on what is unknown, unverified, unreviewed, or excluded.

### view_routes

List of generated views.

Each route includes:

- route_name
- audience
- purpose
- allowed_fields
- excluded_fields
- language_style
- claim_strength
- consent_requirement
- audit_requirement

### transformation_trace

A record of what changed between views.

Each trace item includes:

- source_view
- target_view
- removed_content_type
- compressed_content_type
- preserved_content_type
- reason_for_change
- risk_reduced
- meaning_loss_risk

### evaluation_state

Allowed values:

- untested
- internally_reviewed
- user_tested
- expert_reviewed
- rejected
- revised

## View templates

### Private view template

- Full private notes
- Symbols and metaphors allowed
- Emotional/sensory language allowed
- Contradictions preserved
- No automatic sharing

### Professional handoff template

- What was observed
- When it happened
- Pattern or recurrence
- Functional impact
- Relevant context
- What is uncertain
- Questions for professional
- What this does not prove

### Care-team accessible template

- Recent changes
- Current tasks
- Watch items
- Questions pending
- Permission boundary
- Last updated

### Public-safe method template

- Architecture concept
- Schema fields
- Evaluation criteria
- Safety boundary
- Implementation plan
- No raw private content

### Research-safe aggregate template

- De-identified pattern class
- Frequency or structure only
- No identity
- No rare-context details
- Re-identification risk flag
- Governance requirement

## Hard rules

1. Private content must not flow into public-safe method view.
2. Symbolic content must not become clinical claim unless verified by appropriate professional evidence.
3. The professional view must preserve uncertainty.
4. The research-safe aggregate view must minimize identity and rare-context leakage.
5. Every route must explain what was removed and why.
6. Every route must retain a missingness note.

## First implementation plan

Build a static prototype with one fictional record and five rendered cards:

1. Private card
2. Professional handoff card
3. Care-team card
4. Public-safe method card
5. Research aggregate card

The prototype should show the same invariant structure moving through all five views.
