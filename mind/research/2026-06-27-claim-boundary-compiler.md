# Claim Boundary Compiler

Status labels

- Source status: derived from public GitHub README, existing GitHub mind artifacts, available public-safe file-library snippets, saved-context scan, and current public research scan.
- Claim status: product/research synthesis; not validated software, privacy compliance certification, clinical decision support, therapy, medical advice, veterinary advice, legal advice, or safety certification.
- Privacy status: public-safe abstraction only; no private transcript, household, health, animal-care, financial, location, relationship, credential, or raw identity-specific details included.
- Missingness: no implemented compiler, no redaction UI, no evaluator dataset, no clinician/team testing, no privacy threat model, no consent-revocation workflow, and no legal review.
- Revision reason: prior mind passes built permissioned views and provenance cards; this pass resolves the contradiction between expressive/mythic language and bounded public product claims by defining a claim-boundary compilation step.

## Strongest attractor

Contradiction.

Mirror Cartographer currently has two legitimate language currents:

1. Expressive / symbolic language that preserves lived meaning, beauty, and emotional precision.
2. Public / professional language that must preserve source, claim, privacy, evidence, and safety boundaries.

The contradiction is productive if it becomes a compiler rather than a fight.

## Core finding

MC needs a `ClaimBoundaryCompiler`: a transformation layer that converts private or expressive source material into audience-safe artifacts while preserving a visible trace of what changed.

The compiler does not decide what is ultimately true. It decides what claim is allowed in a given view.

## Why this matters

Existing MC materials already define the project as bounded symbolic reflection with source status, claim status, audit labels, evidence boundaries, and overreach checks. The file-library architecture proof also frames MC as a semantic continuity layer that turns private symbolic embodied state into consent-aware AI context.

This pass adds the missing transformation step:

`raw expression -> invariant meaning -> allowed claim -> audience view -> ViewDiff`

## Public research alignment

Current public research and reporting support this direction:

- Ambient clinical AI workflows increasingly depend on clinician review, consent, privacy safeguards, and transformation from conversational language into professional documentation.
- Research on consumer-to-clinical language shifts shows that AI draft notes and clinician-final notes can be compared as transformation events, not merely as final documents.
- Patient-generated health data tools can support sensemaking through summaries and conversational exploration, but transparency, privacy, and overreliance remain explicit risks.
- Human-AI co-creativity research highlights user control, transparency, externalized thought, and problem clarification as design requirements.
- Health-data leakage reporting shows why anonymization and public repositories require aggressive boundary discipline.

## Method

For each artifact, MC should compile five fields before publishing:

1. Source boundary: where the input came from and what cannot be exposed.
2. Claim boundary: what the artifact is allowed to assert.
3. Privacy boundary: what categories were removed or generalized.
4. Missingness boundary: what has not been built, tested, or verified.
5. Revision boundary: why the public-safe version differs from the original.

## New public-safe object

`ClaimBoundaryRecord`

A compact record attached to every generated public artifact:

- source_kind
- source_confidence
- private_material_used_for_architecture_only
- invariant_meaning
- forbidden_claims
- allowed_claims
- removed_categories
- view_target
- missing_evidence
- revision_reason
- next_allowed_test

## Evaluation question

Can outside readers distinguish expressive metaphor, research hypothesis, product requirement, and verified fact faster when every artifact carries a visible claim-boundary record?

## Allowed next build

Create a fictional demo where one expressive paragraph is compiled into:

1. Private reflection view
2. Professional handoff view
3. Public product view
4. Research question view
5. Investor/customer-facing demo view

Then score whether each view preserved meaning while reducing unsafe claim strength.
