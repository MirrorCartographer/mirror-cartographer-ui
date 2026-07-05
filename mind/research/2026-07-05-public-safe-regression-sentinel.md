# Public-Safe Regression Sentinel

## Core finding

Mirror Cartographer needs a **Public-Safe Regression Sentinel**: a review layer that detects when later implementation work accidentally weakens, bypasses, or contradicts earlier public-safety constraints.

> A public-safe rule is not complete when it is written; it must survive future edits, refactors, demos, fixtures, and synthesis passes without being silently downgraded into decoration.

## Source status

- Source class: private-context-informed architecture synthesis; GitHub commit-history review; prior public-safe research chain.
- Direct private source exposure: none.
- Raw transcript use: none.
- Public-source use: none required for this note.
- GitHub material reviewed: repository identity and recent public-safe commit trail were checked through the connected GitHub tool.

## Claim status

- Claim type: product requirement and evaluation-control proposal.
- Claim strength: design recommendation, not empirical proof.
- Evidence basis: repeated emergence of boundary, fixture, mode, claim, demo, traceability, and publication-readiness requirements in the existing MC mind chain.
- Promotion condition: may be promoted from research note to engineering requirement once at least one regression test or review checklist references it.

## Privacy status

- Privacy class: public-safe abstraction.
- Contains personal, household, health, animal-care, financial, location, relationship, credential, or raw transcript details: no.
- Contains user-specific symbolic examples: no.
- Contains implementation-sensitive secrets: no.
- Rehydration risk: low, because the note describes a general control pattern rather than private content shape.

## Missingness

- Missing full code-index search because the repository search index was unavailable through the connector during this run.
- Missing direct diff review of all prior public-safe files.
- Missing automated test inventory.
- Missing confirmation of whether a CI pipeline currently exists for MC public-safety checks.

## Revision reason

Prior notes define many public-safety layers: source rehydration, memory ingestion, traceability, assumption expiry, mode boundaries, interface contracts, fixture boundaries, inference quarantine, abstraction drift, evaluation coverage, synthesis dependency, publication readiness, composition risk, demo-state separation, and claim promotion.

The meaningful gap is longitudinal: these controls can decay when future artifacts are written quickly, renamed, generalized too far, or treated as optional guidance. The system therefore needs a sentinel that asks whether a new change preserves all earlier safety invariants.

## Product requirement

Before a public-facing MC artifact is merged, published, demonstrated, or used as a fixture, it should pass a regression review against previously accepted public-safe constraints.

The review should answer:

1. Does this artifact reintroduce private-context topology through examples, labels, order, metaphor, scenario structure, or failure cases?
2. Does it weaken an existing source-boundary rule?
3. Does it promote a claim without the required evidence or source status?
4. Does it reuse a demo or fixture state that may have been derived from private material?
5. Does it omit privacy, claim, source, missingness, or revision labels now required by the mind chain?
6. Does it create a new interface implication not covered by an explicit contract?
7. Does composition with nearby artifacts reveal more than each component reveals alone?

## Evaluation criteria

A public-safe regression sentinel passes when:

- Every new public artifact contains source status, claim status, privacy status, missingness, and revision reason.
- Every fixture or demo is independently generated or clearly marked as synthetic.
- Every promoted claim includes a promotion path and evidence class.
- Every mode boundary states what evidence, language, and output claims are allowed.
- Every interface element has a bounded implication contract.
- Every composition review checks whether multiple safe parts combine into an unsafe whole.
- Every old assumption with safety impact has an expiry or revalidation trigger.

It fails when:

- A note says "public-safe" without explaining why.
- A public artifact uses private-derived examples under fictional labels.
- A demo uses a sequence, symbol set, or topology copied from private-context structure.
- A claim is made stronger than its source class supports.
- A later file ignores required labels established by earlier files.
- A generalized abstraction becomes so vague that it cannot change implementation, tests, or product decisions.

## Implementation plan

### Phase 1: Manual checklist

Create a reusable checklist in `mind/evaluation/` that maintainers must apply before publishing public-facing MC artifacts.

### Phase 2: Metadata schema

Represent the labels as structured front matter:

- `source_status`
- `claim_status`
- `privacy_status`
- `missingness`
- `revision_reason`
- `promotion_condition`
- `regression_dependencies`

### Phase 3: Dependency map

Link each new note to the public-safe controls it depends on. A change that modifies one control should identify all downstream notes requiring re-check.

### Phase 4: CI lint

Add a lightweight repository check that flags public-safe notes missing required sections or using disallowed private-source categories.

### Phase 5: Human review gate

Require human review for artifacts marked as publishable, demo-ready, investor-facing, or reusable fixture material.

## Privacy-safe index entry

- Index name: Public-Safe Regression Sentinel
- System area: governance, evaluation, publication safety, artifact lifecycle
- Depends on: traceability manifest, abstraction drift monitor, composition risk auditor, claim promotion pipeline, fixture boundary protocol, inference quarantine protocol
- Public-safe output type: evaluation checklist, metadata schema, CI lint proposal, review protocol
- Current status: research note
- Next useful research target: build a machine-readable public-safe artifact schema and validate prior notes against it

## Boundary note

This note intentionally does not describe private MC source content. It only identifies a structural risk: public-safe controls can regress unless later work is evaluated against the full inherited safety chain.
