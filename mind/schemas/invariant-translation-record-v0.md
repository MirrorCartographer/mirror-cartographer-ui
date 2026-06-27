# Invariant Translation Record v0

Status labels

- Source status: derived from the Semantic Invariant Translation Protocol and existing MC source-boundary architecture.
- Claim status: schema proposal, not implemented software.
- Privacy status: public-safe abstraction; contains no private source details.
- Missingness: no validator, UI, database model, or benchmark integration yet.
- Revision reason: created to make cross-domain semantic translation auditable instead of ornamental.

## Purpose

Record how one underlying meaning changes as it moves through different domain vocabularies.

The schema exists to prevent silent claim drift.

## Fields

### record_id

Stable identifier.

### seed_phrase

The original phrase or idea entering the translation process.

Must be public-safe or abstracted before storage.

### extracted_invariant

The underlying relationship or structure.

Examples:

- repeated attraction
- unresolved incompatibility
- compression of fragments
- state transition
- boundary release
- lineage preservation

### domain_translations

A list of domain-specific translations.

Each entry includes:

- domain
- term
- meaning gained
- meaning lost
- risk of overclaiming
- best use context

### preferred_lens

The domain vocabulary most useful for the current task.

### rejected_lenses

Terms that were considered but rejected.

Each rejection should include a reason.

Examples:

- too clinical
- too mythic
- too vague
- implies proof not present
- hides the user-facing meaning
- unsafe for public release

### source_boundary

What the translation is based on.

Allowed examples:

- public research
- public-safe GitHub artifact
- abstracted private-context pattern
- fictional test case

### claim_boundary

What the translation may and may not claim.

### privacy_boundary

Whether the record is public-safe, private-only, or blocked from storage.

### missingness

What is unknown, untested, or absent.

### blocked_or_revised_wording

Optional.

Use when an original phrase could not be published or was unsafe, over-specific, personal, or inappropriate.

Store only public-safe summaries unless a private-only location exists.

### contrast_note

Explain the meaningful difference between original and translated wording.

### next_test

How to test whether the translation helped.

## Minimal example

Seed phrase:

`I feel stuck.`

Extracted invariant:

`The system is caught in a stable state that resists transition.`

Domain translations:

- physics: local minimum
- ecology: stable niche
- music: suspended cadence
- software: deadlock
- design: bottleneck
- MC: storm node awaiting bridge

Claim boundary:

This does not diagnose a person or prove a cause. It creates multiple ways to inspect the same structure.

Next test:

Ask which translation reveals a practical next action without creating false certainty.

## Integration target

Use this record inside:

- Dream Then Test
- Discovery Provenance Prism
- blocked-to-public-safe contrast ledger
- beauty-as-legibility evaluation
- care communication map
- income wedge demos
