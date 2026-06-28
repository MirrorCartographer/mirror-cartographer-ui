# OneRecordFiveDoorsDemo v0

Status labels

- Source status: derived from public-safe MC architecture and current public research synthesis.
- Claim status: implementation schema draft; unvalidated.
- Privacy status: public-safe abstraction; demo records must be fictional or explicitly consented synthetic examples.
- Missingness: no UI implementation, access-control implementation, encryption model, audit-log backend, or professional review process.
- Revision reason: created to turn continuity/discovery research into a testable artifact format.

## Purpose

Represent one invariant meaning record through five permissioned views while preserving source, claim, privacy, missingness, and transformation labels.

## Required object

### demo_id

Stable identifier.

### invariant_structure

The relationship preserved across all views.

Example:

`recurrent observed change with uncertain interpretation and practical impact`

### fictional_record_notice

Required statement that the demo contains no real private record unless explicitly marked otherwise.

### doors

Exactly five door objects:

1. private_view
2. professional_handoff
3. care_team_accessible
4. public_safe_method
5. research_safe_aggregate

## Door fields

Each door must include:

- door_name
- audience
- purpose
- allowed_content
- excluded_content
- source_status
- claim_status
- privacy_status
- missingness_status
- revision_reason
- allowed_next_action
- prohibited_next_action

## Transformation ledger

Each transition must include:

- from_door
- to_door
- content_removed
- content_compressed
- content_preserved
- language_changed
- claim_strength_changed
- privacy_risk_reduced
- meaning_loss_risk
- verification_needed

## Claim boundary values

Allowed values:

- raw_observation
- private_interpretation
- structured_summary
- professional_question
- product_requirement
- research_question
- aggregate_pattern
- not_allowed_to_claim

## Privacy boundary values

Allowed values:

- private_only
- explicitly_shareable
- care_team_accessible
- professional_handoff
- public_safe_method
- research_safe_aggregate

## Missingness values

Each door must explicitly state:

- unknown_context
- unverified_claims
- excluded_material
- review_status
- evidence_gap

## Safety rules

1. Public-safe method view cannot contain raw private content.
2. Research-safe aggregate view cannot contain rare-context identifying detail.
3. Professional handoff view must preserve uncertainty and avoid diagnosis or treatment claims unless supplied by a qualified professional source.
4. Care-team accessible view must distinguish observation tasks from medical authority.
5. Private view can preserve symbolic material, but symbolic material cannot be promoted into factual or clinical status without evidence.
6. Every door must show what it is not authorized to do.

## First UI test

Render the same fictional record as five cards.

The viewer should be able to compare cards and identify:

- what changed
- why it changed
- what was protected
- what was lost
- what remains uncertain
- what action is allowed