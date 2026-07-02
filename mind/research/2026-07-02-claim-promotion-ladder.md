# Claim Promotion Ladder

## Core finding

Mirror Cartographer needs a Claim Promotion Ladder.

> A reflection does not become a claim because it feels coherent. It becomes a claim only after its source, boundary, evidence class, privacy class, and revision path are explicit.

## Public-safe summary

MC works across symbolic reflection, memory, product requirements, governance framing, and public-facing research language. Those lanes are useful only if the system prevents accidental authority upgrades.

A private symbolic reflection may be meaningful without being factual evidence. A repeated pattern may be useful without being publishable. A design requirement may be valid even when the raw source that inspired it remains private. A public claim should only be emitted after the system records how far the claim is allowed to travel.

The ladder formalizes that movement.

## Source status

- Source class: mixed private-context synthesis, File Library artifact snippets, and GitHub mind continuity.
- Public artifact basis: MC is already framed as provenance-native cognition infrastructure with replayable reasoning graphs, contradiction persistence, provenance-aware memory, governance telemetry, delegation lineage, temporal cognition trajectories, and symbolic state transitions.
- Continuity basis: existing MC continuity materials distinguish source layers, reliability, artifact-backed claims, inference, symbolic/speculative layers, and action/open-loop items.
- GitHub basis: this note continues the existing mind/research pattern around provenance packets, revision ledgers, source boundaries, memory classification, authority routing, and source-to-requirement distillation.

## Claim status

- Claim type: product architecture requirement.
- Confidence: high as a design requirement; not a claim of external market validation.
- Evidence class: internal architecture consistency plus public-safe artifact synthesis.
- External validation: missing.
- Implementation validation: missing until encoded in UI, schema, tests, or review workflow.

## Privacy status

- Privacy class: public-safe abstraction.
- Raw private material included: none.
- Personal, household, health, animal-care, financial, location, relationship, credential, and raw transcript details: excluded.
- Allowed publication form: architecture note, product requirement, evaluation checklist, schema proposal, or implementation plan.

## Missingness

- No exhaustive raw chat archive was inspected in this run.
- GitHub code search availability was limited by repository indexing status.
- Existing mind/research files were not fully fetched; continuity was inferred from recent known write sequence and available repository metadata.
- No live UI schema was inspected.
- No external governance literature was rechecked for this note.

## Revision reason

Recent MC mind notes defined boundaries: evidence lanes, source boundaries, memory classification, reflection authority, public abstraction, and source-to-requirement distillation. The missing control is a stepwise ladder for deciding when an item may move from reflection to durable memory, from memory to requirement, from requirement to research claim, or from research claim to public artifact.

This note adds that missing promotion control.

## Ladder levels

### L0 — Raw signal

Unprocessed input or observation.

Allowed movement:
- temporary session use
- immediate reflection
- user clarification

Not allowed:
- public export
- durable claim
- identity inference
- evidence assertion

Required labels:
- source status
- privacy status
- uncertainty status

### L1 — Private reflection

An interpreted response generated inside a bounded session.

Allowed movement:
- user-facing reflection
- session-local comparison
- contestation or rejection

Not allowed:
- memory persistence without consent
- public artifact conversion
- factual claim promotion

Required labels:
- mode
- author/authority lane
- contestability
- save/export permission

### L2 — Pattern candidate

A recurring or structurally meaningful pattern that may be worth tracking.

Allowed movement:
- private index
- missingness log
- user review
- future comparison

Not allowed:
- claim of truth
- diagnosis or proof
- public narrative

Required labels:
- recurrence basis
- confidence level
- counterevidence status
- privacy boundary

### L3 — Distilled requirement

A public-safe product need abstracted away from private specifics.

Allowed movement:
- product requirements
- implementation plans
- test plans
- architecture diagrams

Not allowed:
- raw-source disclosure
- personal-example leakage
- overstated validation

Required labels:
- requirement source class
- user value protected
- risk if absent
- acceptance test

### L4 — Research question

A question suitable for literature review, prototype testing, or benchmark design.

Allowed movement:
- public research backlog
- evaluation framework
- grant/fellowship language
- technical roadmap

Not allowed:
- claiming solved status
- implying clinical/legal/financial authority
- implying representative population evidence

Required labels:
- hypothesis boundary
- evidence needed
- evaluation method
- falsification route

### L5 — Public claim

A public statement about what MC is, does, or may support.

Allowed movement:
- README
- website
- pitch materials
- public whitepaper

Not allowed:
- private-source dependence without abstraction
- unsupported efficacy claims
- personal data as proof

Required labels:
- source class
- claim class
- validation level
- revision history

### L6 — Validated artifact

A public-facing claim backed by a functioning implementation, test result, external source, or reproducible demonstration.

Allowed movement:
- product proof
- demo
- case-neutral evaluation report
- investor/researcher-facing artifact

Required labels:
- validation method
- test date
- limitations
- reproducibility status
- revision reason

## Product requirements

1. Every reflection object should carry a `claim_level` field from L0-L6.
2. The system should block public export for L0-L2 unless converted through a public-safe abstraction process.
3. L3 items must include an acceptance test before entering the build queue.
4. L4 items must state what evidence would change or weaken the claim.
5. L5 items must show claim status and validation level in public materials.
6. L6 items must link to implementation evidence, evaluation output, or reproducible demonstration.
7. The UI should show promotion warnings when a user or system attempts to move content upward.
8. Rejected reflections should remain usable only as boundary evidence, not as truth evidence.

## Evaluation criteria

A Claim Promotion Ladder implementation passes if:

- no private reflection can become public content without an explicit abstraction step;
- no symbolic interpretation can be displayed as factual evidence without lane conversion;
- every public claim contains a visible claim status;
- every requirement contains a source class and acceptance test;
- every revision records why the item moved, changed, stalled, or was refused;
- ambiguous material defaults downward, not upward;
- the user can contest or demote a claim at any point before export.

## Implementation sketch

Suggested schema fields:

- `claim_level`
- `source_status`
- `claim_status`
- `privacy_status`
- `evidence_class`
- `allowed_movements`
- `blocked_movements`
- `promotion_reason`
- `revision_reason`
- `missingness_notes`
- `public_safe_summary`
- `raw_source_pointer_private`

The private pointer should never be exported. Public artifacts should carry only the public-safe summary and the classification labels.

## Research questions

1. How should MC distinguish subjective coherence from evidence-backed validity?
2. What UI language makes claim status visible without making the product feel bureaucratic?
3. What minimum metadata is required before a reflection can become a reusable requirement?
4. How should the system handle claims that are useful but unverifiable?
5. Can claim promotion be made visually legible through a map, ladder, color band, or custody trail?

## Operating line

Meaning can rise. Authority must climb by rule.
