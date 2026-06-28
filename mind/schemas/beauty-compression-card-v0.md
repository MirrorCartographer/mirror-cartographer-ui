# BeautyCompressionCard v0

Status labels

- Source status: derived from existing MC schemas and current public interface/explainability research.
- Claim status: schema proposal, not implemented UI or validated interaction pattern.
- Privacy status: public-safe abstraction.
- Missingness: no renderer, no accessibility pass, no user testing, no scoring dataset.
- Revision reason: created to convert Beauty from aesthetic preference into a measurable interface requirement.

## Purpose

`BeautyCompressionCard` is a compact visual-structural artifact for making complex MC state understandable without erasing uncertainty.

It is a child of `EmergentProvenanceCard`.

Difference:

- `EmergentProvenanceCard` preserves the record.
- `BeautyCompressionCard` makes the record perceptually graspable.

## Required fields

### identity

- card_id
- title
- created_at
- parent_artifact
- current_lifecycle_state
- strongest_attractor

### invariant layer

- invariant_statement
- seed_phrase
- meaning_preserved
- meaning_changed
- meaning_lost
- meaning_gained

### lens layer

- selected_lens
- audience
- allowed_vocabulary
- blocked_vocabulary
- claim_limit
- why_this_lens

### boundary layer

- source_status
- claim_status
- privacy_status
- missingness_status
- release_level
- redacted_categories

### visual compression layer

- layout_metaphor
- primary_shape
- boundary_encoding
- lifecycle_encoding
- contradiction_encoding
- missingness_encoding
- next_action_encoding

### practical layer

- income_lane_relevance
- care_or_social_support_relevance
- implementation_relevance
- next_test

## Visual encoding rules

### Source boundary

Must be visible before the user reads details.

Possible encodings:

- outer frame
- provenance ribbon
- source ring
- origin marker

### Claim boundary

Must prevent speculative material from looking proven.

Possible encodings:

- claim-strength scale
- evidence badge
- hypothesis marker
- test-required marker

### Privacy boundary

Must show whether the object is public-safe, private-only, restricted, or blocked.

Possible encodings:

- release seal
- privacy gate
- redaction band

### Missingness

Must be visible without making the artifact look failed.

Possible encodings:

- unfilled chamber
- dotted edge
- open question node
- gap marker

### Contradiction

Must appear as usable tension rather than error.

Possible encodings:

- opposing arrows
- split lens
- braided line
- pressure seam

## Scoring rubric

Score 0-2 for each item.

1. Boundary visibility
2. Cognitive compression
3. Overclaim resistance
4. Visual memorability
5. Accessibility potential
6. Practical action clarity
7. Transformation trace preservation

Maximum score: 14.

Minimum score for demo use: 10.

Minimum score for Museum candidate: 13.

## Accessibility rule

A card is not complete unless it can be represented in:

- visual layout
- plain language summary
- screen-reader-friendly structure
- high-contrast mode
- non-color-only boundary markers

## First sample target

Invariant:

`meaning-state provenance across time and context`

Suggested layout metaphor:

A compass rose inside a museum label, where each direction is a lens and the outer ring carries source, claim, privacy, and missingness status.
