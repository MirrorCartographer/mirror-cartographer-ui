# Context Lens Router

Status labels

- Source status: derived from public-safe File Library materials, existing GitHub mind schemas, current public research on AI transparency, AI literacy, and human-AI co-creation.
- Claim status: architecture proposal and positioning hypothesis, not validated product-market fit or implemented software.
- Privacy status: public-safe abstraction; excludes personal, household, health, animal-care, financial, location, relationship, credential, and raw transcript details.
- Missingness: no UI router, buyer interviews, learning assessment, governance pilot, or usability study completed.
- Revision reason: created because the active contradiction is that Mirror Cartographer has at least two true public framings that can weaken each other if collapsed too early.

## Core finding

Mirror Cartographer should not be forced into one public vocabulary.

It needs a `ContextLensRouter`.

The same underlying architecture can be expressed through different domain lenses without changing the core object:

- symbolic orientation lens
- provenance infrastructure lens
- AI literacy lens
- governance/oversight lens
- creative co-creation lens
- care-communication support lens
- product-interface lens

The router decides which vocabulary is appropriate for the current audience, task, and risk boundary.

## Existing mind comparison

The `Semantic Invariant Translation Protocol` says MC should translate invariant structures before words.

The `EmergentProvenanceCard` says one compact card should carry source, claim, privacy, invariant meaning, domain translation, lifecycle state, and next test.

This artifact adds a routing layer above both:

- The invariant is the stable meaning.
- The card is the portable record.
- The router chooses the lens.

## Why this matters

A single sentence like `Mirror Cartographer tracks meaning across time` can be true in several ways:

- As a personal reflection system, it means continuity of symbols and states.
- As governance infrastructure, it means trajectory-aware oversight.
- As AI literacy, it means users learn to inspect how an output was made.
- As care communication support, it means observations remain bounded and organized.
- As creative practice, it means ideas retain lineage and contradiction.

The mistake is treating these as competing identities.

They are different lenses over the same invariant:

`meaning-state provenance across time and context`.

## Router inputs

A routing decision should inspect:

- audience: individual, organization, researcher, educator, builder, care-support setting, funder
- risk level: low, moderate, high
- evidence level: speculative, prototype, tested, externally validated
- privacy sensitivity: public-safe, private-only, restricted, blocked
- desired action: understand, evaluate, buy, build, research, preserve
- allowed claim strength: metaphor, model, hypothesis, implemented behavior, evidence-backed result

## Router outputs

The router should produce:

- chosen lens
- allowed vocabulary
- blocked vocabulary
- one-sentence public description
- evidence requirements
- next test
- release boundary

## Lens table

### Symbolic orientation lens

Use when explaining human meaning-making, symbolic state, reflective interfaces, and nonlinear cognition.

Allowed vocabulary:

- symbolic mapping
- meaning continuity
- reflective interface
- consent-bounded state
- emotional-symbolic translation

Blocked vocabulary:

- diagnosis
- treatment
- cure
- objective truth engine

### Provenance infrastructure lens

Use when explaining AI governance, reasoning trajectories, auditability, and long-running agentic systems.

Allowed vocabulary:

- provenance-native cognition infrastructure
- replayable reasoning graph
- trajectory-aware oversight
- governance telemetry
- delegation lineage

Blocked vocabulary:

- guaranteed alignment
- full interpretability
- proof of safety
- sentient system

### AI literacy lens

Use when explaining practical education, workforce adaptation, nonprofit adoption, and responsible AI use.

Allowed vocabulary:

- output autopsy
- source boundary
- claim boundary
- critical evaluation
- improvement-oriented use

Blocked vocabulary:

- expert replacement
- automated truth
- effortless mastery

### Care communication support lens

Use when explaining observation organization and professional conversation preparation.

Allowed vocabulary:

- observation summary
- uncertainty preservation
- question preparation
- source-bounded communication

Blocked vocabulary:

- diagnosis
- triage authority
- treatment recommendation
- urgency ranking

## Current external signal

Recent AI transparency research increasingly frames transparency as an architectural design requirement rather than a simple post-hoc label, especially for interleaved human-AI outputs, heterogeneous user expertise, and machine-readable verification.

Recent human-AI co-creation research emphasizes user control, externalized thought, transparency, early problem clarification, and adaptive proactive support.

Recent AI literacy and workforce efforts indicate a practical market for tools that help people move from uncritical AI use toward critical evaluation and improvement-oriented practice.

## Public-safe research questions

1. Which lens produces the fastest accurate understanding for a new viewer?
2. Which lens creates the least overclaim risk?
3. Which lens creates the clearest paid wedge?
4. Which lens is most compatible with current AI literacy funding?
5. Can a single EmergentProvenanceCard switch lenses without changing its invariant?

## Implementation plan

Create `ContextLensRouter` as a small schema and UI rule set.

Each routed artifact should include:

- invariant
- selected lens
- audience
- allowed words
- blocked words
- claim limit
- public-safe summary
- next test

## Next concrete build

Create a demo card called:

`One Invariant, Seven Lenses`

It should show the same MC concept translated into seven contexts while preserving source, claim, privacy, and missingness labels.
