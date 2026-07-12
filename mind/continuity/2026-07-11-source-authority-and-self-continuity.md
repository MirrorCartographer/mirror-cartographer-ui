# Source Authority and Self-Continuity

## Status

- Team: `continuity_mining`
- Claim class: project operating rule
- Source status: observed user directives plus repository history
- Privacy status: public-safe abstraction; no private transcript, health detail, credential, or identifying event reproduced
- Implementation status: documented continuity rule; enforcement tooling remains proposed

## Recovered memory

Mirror Cartographer continuity belongs to the evolving project model, not to any single account, chat thread, summary, deployment, or repository snapshot.

The durable object is the **project self**: a provenance-linked sequence of decisions, definitions, artifacts, tests, contradictions, and revisions. Accounts and chats are containers that may preserve, omit, copy, compress, or reorder parts of that sequence.

## Source authority ladder

When two records conflict, do not flatten them into one answer. Preserve both and resolve by evidence class.

1. **Direct original record** — contemporaneous user statement, source artifact, test output, commit, or deployment evidence.
2. **Authenticated copy** — exported or copied record whose origin and boundaries are known.
3. **Derived structured memory** — decision log, concept graph, timeline, or synthesis linked to its sources.
4. **Retrospective recollection** — later description of what happened, retained as testimony rather than exact transcript.
5. **Inference** — a reasoned relationship not directly stated or implemented.
6. **Proposal** — a future design, rule, interpretation, or desired capability.

Higher position does not automatically mean greater personal importance. It means stronger authority for claims about what was literally said, built, tested, or deployed.

## Required claim states

Every continuity record should mark claims as one of:

- `observed`: directly present in a source or behavior
- `inferred`: derived from multiple observations
- `proposed`: intended but not yet implemented
- `superseded`: once active, later replaced
- `unresolved`: evidence remains insufficient or contradictory

No synthesis may silently convert `inferred` or `proposed` into `observed`.

## Contradiction protocol

A contradiction is not deleted. Record:

- both claims;
- their source classes and dates;
- the context in which each was valid;
- whether the conflict is semantic, temporal, implementation-level, or factual;
- the current operational choice;
- what evidence would reverse that choice.

Use `superseded` only when a later decision clearly replaces an earlier one. Use `unresolved` when replacement is not explicit.

## Container-loss rule

Loss of an account, thread, file, deployment, or index is a **provenance break**, not proof that the underlying project history never existed.

Recovered copies may restore content, but they do not regain original metadata automatically. They must be labeled as copies and linked to whatever origin evidence remains.

## Project-self invariant

The system must be able to answer five separate questions:

1. What was directly observed?
2. What did the project infer from it?
3. What decision was made at that time?
4. What later evidence changed or superseded that decision?
5. Which parts are safe to expose in this view?

A record that cannot answer those questions is a note, not yet a continuity artifact.

## Relationship to permissioned views

The existing permissioned-view principle remains compatible with this rule:

`one continuity record -> multiple bounded views + visible transformation trace`

The private source layer may preserve exact meaning. Public artifacts should expose only the minimum method, schema, status, evidence boundary, and transformation rationale necessary for use.

## Acceptance criteria for future tooling

A continuity validator should reject a record when:

- it lacks a source class;
- it lacks a claim state;
- it merges conflicting claims without retaining both;
- it calls a copied transcript an original;
- it presents a proposal as an implementation;
- it exposes source material outside the permission boundary;
- it cannot identify the revision that changed the operational state.

## Current unresolved items

- The repository does not yet demonstrate an automated validator for this contract.
- The canonical location of the complete decision graph remains unresolved.
- The relationship between imported chat copies and original account metadata must remain explicitly qualified.
- This document establishes an operating rule; it does not prove historical completeness.
