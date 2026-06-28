# ContextLensRouter v0

Status labels

- Source status: derived from public-safe MC architecture materials and current GitHub mind artifacts.
- Claim status: schema proposal, not implemented routing software.
- Privacy status: public-safe abstraction.
- Missingness: no parser, prompt contract, interface component, routing test suite, or evaluator scores yet.
- Revision reason: created to preserve contradictory but valid MC framings without collapsing them into one weak description.

## Purpose

`ContextLensRouter` selects the safest and most useful vocabulary for explaining the same invariant structure to different audiences.

It prevents public MC artifacts from mixing lenses in ways that create confusion or overclaim.

## Required fields

### identity

- router_record_id
- created_at
- artifact_or_concept_name
- invariant_statement
- lifecycle_state

### audience_context

- primary_audience
- secondary_audience
- intended_action
- required_background_level
- expected_time_to_understand

### risk_context

- privacy_sensitivity
- overclaim_risk
- domain_sensitivity
- evidence_requirement
- allowed_claim_strength

### selected_lens

- lens_name
- lens_reason
- allowed_vocabulary
- blocked_vocabulary
- public_description
- private_context_excluded

### comparison_layer

For each rejected lens:

- lens_name
- why_not_selected
- what_it_would_make_visible
- what_it_would_hide
- risk_if_used_now

### output_boundary

- source_status
- claim_status
- privacy_status
- missingness
- revision_reason
- next_test

## Lens options

### symbolic_orientation

Useful for:

- reflection systems
- meaning-making
- nonlinear cognition
- symbolic interface design

Default claim limit:

Architecture hypothesis or prototype, not clinical evidence.

### provenance_infrastructure

Useful for:

- AI governance
- reasoning trajectory audit
- agent oversight
- delegation lineage

Default claim limit:

Infrastructure concept or prototype, not guaranteed alignment.

### ai_literacy

Useful for:

- education
- nonprofit adoption
- workforce adaptation
- public demo packages

Default claim limit:

Training/evaluation framework, not universal AI competence.

### creative_cocreation

Useful for:

- Dream Then Test
- ideation systems
- originality evaluation
- artistic/research workflows

Default claim limit:

Co-creative workflow hypothesis, not proof of creativity improvement without evaluation.

### care_communication_support

Useful for:

- organizing observations
- preparing questions
- preserving uncertainty
- communication support

Default claim limit:

Communication support only, never diagnosis, triage, or treatment authority.

### product_interface

Useful for:

- demos
- UI specs
- buyer explanations
- interaction design

Default claim limit:

Usability hypothesis until tested.

## Minimal markdown template

Title:

Invariant:

Audience:

Selected lens:

Allowed vocabulary:

Blocked vocabulary:

Public description:

Claim limit:

Missingness:

Next test:

## First test case

Input invariant:

`meaning-state provenance across time and context`

Expected route for nonprofit AI literacy audience:

- selected lens: ai_literacy
- allowed vocabulary: output autopsy, source boundary, claim boundary, critical evaluation, improvement-oriented AI use
- blocked vocabulary: cure, diagnosis, guaranteed truth, sentient mirror, full alignment
- next test: can a learner correctly identify source, claim, privacy, and missingness boundaries after using one card?
