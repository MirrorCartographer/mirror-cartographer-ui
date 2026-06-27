# EmergentProvenanceCard v0

Status labels

- Source status: derived from current GitHub mind architecture and public research on provenance, transparency, human-AI co-creation, and bounded care communication.
- Claim status: schema proposal, not implemented software or validated UX.
- Privacy status: public-safe abstraction.
- Missingness: no parser, UI component, automated scoring, user testing, or integration yet.
- Revision reason: created to convert the emergence pass into a reusable build object.

## Purpose

`EmergentProvenanceCard` is a compact record for showing how one meaning changes across contexts without losing its source, claim, privacy, and missingness boundaries.

It exists because MC should not merely preserve outputs.

It should preserve meaning movement.

## Required fields

### identity

- card_id
- title
- creation_date
- current_lifecycle_state
- strongest_attractor

### source_boundary

- source_status
- source_types_used
- private_context_used_for_architecture_only: true/false
- public_sources_used
- source_confidence

### claim_boundary

- claim_status
- allowed_claims
- blocked_claims
- evidence_level
- next_disconfirmation_test

### privacy_boundary

- privacy_status
- public_safe_summary
- redacted_categories
- release_level

### meaning_layer

- seed_phrase
- extracted_invariant
- transformation_trace
- meaning_preserved
- meaning_lost
- meaning_gained

### domain_rotation_layer

Each domain translation should include:

- domain
- translated_term
- what_the_term_makes_visible
- what_the_term_hides
- overclaim_risk
- usefulness_score

Suggested domains:

- physics
- biology
- music
- design
- software
- governance
- care communication
- creative practice
- MC internal language

### lifecycle_layer

- previous_state
- current_state
- transition_reason
- what_strengthens_it
- what_weakens_it
- museum_candidate: true/false

### practical_layer

- income_lane_relevance
- care_or_social_support_relevance
- implementation_relevance
- research_queue_relevance
- next_public_safe_artifact

## Minimal markdown template

Title:

Invariant:

Current words:

Domain rotations:

Boundary labels:

Lifecycle state:

Practical lane:

Next test:

## Scoring rubric

Score 0-2 for each:

1. Boundary clarity
2. Translation trace clarity
3. Cross-domain usefulness
4. Overclaim resistance
5. Practical actionability
6. Visual/interface readiness

Maximum score: 12.

A score below 8 means the card should stay in research notes.

A score of 8-10 means it can become a demo object.

A score of 11-12 means it may be Museum-worthy.

## First test candidate

Use the invariant `repeated attraction` and compare:

- attractor
- selection pressure
- tonal center
- dependency gravity
- force current

The test should ask whether each term changes behavior, not only whether it sounds accurate.
