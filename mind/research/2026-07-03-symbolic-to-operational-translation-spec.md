# Symbolic-to-Operational Translation Spec

Date: 2026-07-03
Repository area: mind/research
Public-safe status: safe to publish
Revision reason: Add a product-requirements layer that converts Mirror Cartographer's symbolic reflection language into testable, implementable, privacy-preserving system behavior.

## Core finding

Mirror Cartographer needs a Symbolic-to-Operational Translation Spec.

Operating line:

> A symbol may enter as meaning, but it must leave the build pipeline as a typed interface event, bounded claim, or testable product requirement.

## Source status

- Source class: mixed private/public project context, File Library artifacts, and repository-intent context.
- Public source anchors available: public-safe project definitions describe Mirror Cartographer as a human-centered AI reflection system focused on symbolic-emotional mapping, psychological orientation, reflective AI interaction, neurodivergent-accessible interfaces, and emotionally sustainable AI interaction.
- Private-context use: private context was used only to identify architectural pressure points and recurring system needs. No private transcript content, household details, health data, animal-care data, financial data, locations, relationship details, credentials, or raw user-specific examples are included.
- GitHub source status: repository write target is available as `MirrorCartographer/mirror-cartographer-ui`; repository search did not surface prior matching mind files through code search, so this file is added as a new public-safe research artifact rather than modifying an existing one.

## Claim status

- Claim type: product architecture requirement.
- Confidence: medium-high.
- Evidence basis: repeated MC materials define symbolic cognition, emotional mapping, reflective AI dialogue, adaptive tone, session memory, and exportable artifacts as core system concepts. These imply a gap between expressive symbolic language and implementable software behavior.
- Not a claim of: clinical efficacy, diagnosis, treatment, model consciousness, sentience, or validated therapeutic outcome.
- Allowed use: requirements design, evaluation planning, schema design, privacy review, interface testing, and public explanation.
- Disallowed use: marketing claims that imply proof of mental-health benefit, autonomous diagnosis, or private-case generalization.

## Privacy status

- Publication level: public-safe abstraction.
- Contains personal data: no.
- Contains raw transcript details: no.
- Contains sensitive household, health, animal-care, financial, location, relationship, or credential details: no.
- Derivation rule: patterns may inform the method, but examples must be synthetic or generalized before publication.

## Missingness

- No full repository tree was available through the current search pass.
- No live application behavior was tested in this run.
- No user study, benchmark set, or formal evaluation dataset was inspected.
- No claim is made that the spec is already implemented in the UI.
- Code search may be incomplete or stale; this file should be reconciled later against actual routes, components, schemas, and prompts.

## Problem

Mirror Cartographer uses symbolic, emotional, spatial, and reflective language. That language is powerful for human meaning-making, but software systems cannot safely act on it until it is translated into bounded operational forms.

Without a translation layer, the system risks four failures:

1. Interpretive overreach: poetic language becomes treated as evidence.
2. Implementation drift: symbolic concepts do not map to stable UI, schema, or prompt behavior.
3. Privacy leakage: private examples become the easiest way to explain product behavior.
4. Evaluation fog: outputs feel resonant but cannot be tested for safety, usefulness, or boundary compliance.

## Required translation layers

### 1. Symbol intake layer

Every user-submitted symbol should be captured as a structured event, not only as prose.

Minimum fields:

- `event_id`
- `session_id`
- `input_mode`
- `symbol_text`
- `symbol_class`
- `user_selected_context_boundary`
- `consent_scope`
- `sensitivity_flag`
- `created_at`

Allowed symbol classes:

- image/metaphor
- body-map label
- color/texture
- relational pattern
- environment cue
- affect label
- narrative fragment
- uncertainty marker
- user correction

### 2. Interpretation boundary layer

Before generating a reflection, the system should determine what kind of output is allowed.

Boundary questions:

- Is this a reflection, hypothesis, question, summary, pattern label, or action suggestion?
- Is the source private, public, synthetic, or mixed?
- Is there enough evidence to state, or only enough to ask?
- Does the output need a disclaimer, narrowing phrase, or external verification handoff?
- Should this remain session-local rather than become durable memory?

### 3. Output router layer

The same symbolic input may produce different output types depending on evidence and consent.

Output routes:

- `reflective_sentence`: emotionally resonant but non-claiming response.
- `pattern_candidate`: tentative recurring structure requiring confirmation.
- `schema_update`: structured data change.
- `question_prompt`: clarifying prompt that avoids leading the user.
- `safety_boundary`: refusal, grounding, or external support cue.
- `export_artifact`: public-safe or private artifact depending on source class.
- `implementation_requirement`: product backlog item derived from a recurring need.

### 4. Evaluation layer

Symbolic reflection should be evaluated on behavior, not vibe alone.

Evaluation criteria:

- Boundary accuracy: output matches allowed source and privacy class.
- Claim discipline: uncertain material stays uncertain.
- Non-leading reflection: system does not coerce the user toward a preferred interpretation.
- User correction uptake: later output incorporates explicit correction.
- Accessibility: output remains readable, exportable, and understandable without hidden formatting.
- Testability: each requirement can be converted into at least one unit test, prompt eval, UX test, or schema validation.

## Implementation plan

Phase 1: Create schema

- Add a `SymbolEvent` type.
- Add a `ReflectionBoundary` type.
- Add an `OutputRoute` enum.
- Add a `ClaimStatus` enum.
- Add a `PrivacyStatus` enum.

Phase 2: Add prompt contract

The reflection prompt should receive structured context:

- source class
- consent scope
- sensitivity flag
- allowed output route
- uncertainty level
- memory allowance
- publication allowance

Phase 3: Add linting

Before saving, exporting, or publishing any reflection artifact, run a boundary lint:

- personal-data check
- unsupported-claim check
- health/legal/financial advice check
- private-example leakage check
- overinterpretation check
- missingness label check

Phase 4: Add synthetic test suite

Use synthetic symbol cases rather than private examples.

Test categories:

- low-risk metaphor
- ambiguous affect symbol
- body-related symbolic phrase
- relational metaphor
- crisis-adjacent language
- public artifact export
- user correction after prior reflection
- mixed-source research note

## Research questions

1. What is the smallest structured representation that preserves symbolic meaning without exposing private context?
2. How should MC distinguish a meaningful reflection from an actionable claim?
3. Which outputs should be session-local by default?
4. How should user corrections modify future reflections without creating false memory certainty?
5. What evaluation set can test resonance, restraint, and privacy at the same time?

## Public-safe index tags

- symbolic cognition
- reflection system
- source boundary
- claim discipline
- privacy-preserving derivation
- output routing
- evaluation criteria
- product requirements
- synthetic examples
- accessibility

## Revision path

Next useful revision:

- Reconcile this spec against actual application code.
- Create `types/reflection.ts` or equivalent schema location.
- Add synthetic eval fixtures.
- Add a publication-boundary lint command.
- Link this spec to any existing mind/research files once repository search/indexing exposes them.
