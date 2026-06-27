# Semantic Invariant Translation Protocol

Status labels

- Source status: derived from public-safe File Library architecture notes, current GitHub mind artifacts, and current public research on AI provenance, transparency, human-AI co-creation, and clinical documentation language shifts.
- Claim status: architecture hypothesis and implementation protocol, not validated empirical evidence.
- Privacy status: public-safe abstraction; no personal, household, health, animal-care, financial, location, relationship, credential, or raw transcript details.
- Missingness: no implemented parser, benchmark, user testing, clinical review, or buyer validation yet.
- Revision reason: created because the active attractor is compression: many symbolic and technical vocabularies need one interoperable translation layer.

## Core discovery

Words are not the most stable unit.

The more stable unit is the invariant structure beneath the words.

A single underlying structure can appear as different terms across fields:

- repeated attraction
- unresolved incompatibility
- many fragments becoming one structure
- bounded transformation
- traceable lineage
- controlled release
- state change over time

MC should not operate as a thesaurus.

It should operate as a structure translator.

## Relationship to existing MC mind

The existing `Discovery Provenance Prism` says the primitive unit should be the transformation trace.

This protocol adds the missing bridge:

A transformation trace becomes more useful when it records not only what words changed, but what invariant structure survived translation.

## Protocol: Translate meanings before words

### Step 1 — Extract the invariant

Ask:

What relationship is happening here?

Examples:

- something repeatedly pulls attention or behavior
- separate fragments become one compressive form
- a contradiction refuses premature resolution
- an output becomes public only after boundary filtering
- a private state becomes a shareable abstract schema

### Step 2 — Rotate across domains

For each invariant, produce domain translations.

Example: repeated attraction

- physics: attractor
- biology: selection pressure
- music: tonal center
- software: dependency gravity
- design: focal hierarchy
- governance: incentive structure
- MC: force current

### Step 3 — Preserve boundary labels

Each translation must keep:

- source boundary
- claim boundary
- privacy boundary
- missingness
- allowed use
- blocked use

### Step 4 — Compare lost meaning

When one vocabulary replaces another, record what changed.

Examples:

- `contradiction` may imply error.
- `dissonance` may imply possible resolution.
- `trade-off` may imply cost under constraints.
- `differential question` may imply responsible uncertainty.

The translation is not neutral.

Each domain word carries a behavioral instruction.

### Step 5 — Choose the useful lens

The correct word is not always the most technical word.

The useful word is the one that helps the current context see the structure without overclaiming.

## Implementation object

Create a future schema called `InvariantTranslationRecord`.

Required fields:

- seed phrase
- extracted invariant
- domain translations
- preferred lens
- rejected lenses
- meaning gained
- meaning lost
- source boundary
- claim boundary
- privacy boundary
- missingness
- next test

## Current research signal

AI transparency work increasingly treats provenance as an architectural requirement rather than a final label.

Current research on dual-layer provenance and watermarking shows that independent verification layers can conflict unless jointly audited.

Healthcare documentation research shows that AI-generated conversational language often gets transformed into standardized professional language during clinician review. This supports the idea that translation is not merely wording; it is a domain-governed state change.

AI literacy research also increasingly frames AI competence as developmental progression, not simple tool adoption.

## MC claim boundary

MC may become useful because it can preserve the translation path between vocabularies.

It should not claim that cross-domain translation proves truth.

The narrower claim is:

MC can make meaning changes inspectable, reducing the chance that a metaphor, label, or public-safe rewrite silently changes the underlying claim.

## Next build target

Create `mind/schemas/invariant-translation-record-v0.md` and use it to score one Dream Then Test run.
