# MC Research Note — Source Boundary Matrix

Date: 2026-07-02
Status: public-safe architecture note

## Core finding

Mirror Cartographer needs a **Source Boundary Matrix**.

Operating line:

> A source can guide interpretation without being allowed to become evidence, memory, export, or identity.

## Source status

- Source family: prior MC specifications, public-positioning files, saved architecture context, and existing GitHub/mind direction.
- Source use: architecture understanding only.
- Private-context use: abstracted into method requirements; no raw transcript content, household context, health context, animal-care context, financial context, location context, relationship context, or credential detail is included.
- GitHub status: repository write target is a private MC implementation/mind repository; this note is still written as if it may later be public.

## Claim status

- Claim type: product architecture requirement.
- Confidence: medium-high.
- Evidence basis: repeated MC framing around provenance-aware memory, consent-bounded continuity, replayable reasoning, contradiction preservation, public-safe export, and source/claim separation.
- Not claimed: that MC currently implements this fully; that any private source is public evidence; that symbolic resonance is factual proof.

## Privacy status

Public-safe.

This note contains only generalized architecture language. It deliberately excludes personal facts, household facts, health or animal-care details, financial facts, locations, relationship details, credentials, and raw transcript material.

## Missingness

- Exact current implementation coverage is not confirmed in this note.
- Current UI affordances for source labels are not confirmed.
- Existing file inventory may be incomplete because the GitHub code-search index is unavailable or incomplete for the repository.
- The note does not yet include a test fixture or schema migration.

## Revision reason

Prior notes define public export gates, evidence lane firewalls, provenance packets, missingness, revision reasons, mode handoff, consent gradients, and claim taxonomy. The missing connective layer is a stable matrix that answers: what is each source allowed to do?

## Product requirement

Each MC source should carry an explicit boundary record with at least these fields:

1. `source_kind` — chat, user note, generated reflection, file, external citation, operator observation, system rule, evaluator note, or derived abstraction.
2. `source_visibility` — private, restricted, public-safe, public, unknown.
3. `allowed_roles` — understand, summarize, infer, remember, evaluate, export, publish, train/test fixture, or block.
4. `disallowed_roles` — identity claim, evidence claim, public artifact, durable memory, model instruction, medical/legal/financial conclusion, or external representation.
5. `claim_ceiling` — maximum public claim level the source can support.
6. `retention_policy` — ephemeral, session-only, user-approved memory, project memory, exportable artifact, deletion-required.
7. `revision_trigger` — new evidence, user correction, privacy downgrade, mode shift, source conflict, missing context, or stale source.

## Evaluation criteria

A Source Boundary Matrix passes if MC can:

- show why a private source influenced architecture without exposing the private source;
- prevent a private source from becoming public language by accident;
- separate resonance, inference, source-grounded evidence, and implementation fact;
- downgrade claims when a source is stale, private, missing, or contradictory;
- explain what changed when a source boundary changes;
- export a public-safe artifact with source classes but no sensitive source contents.

## Implementation plan

1. Add a `sourceBoundary` object to MC reflection/session records.
2. Add a public-safe compiler pass that strips restricted source contents while preserving source class and claim ceiling.
3. Add UI labels for source status, claim status, privacy status, missingness, and revision reason.
4. Add an export preflight check that fails closed when any source has unknown visibility or unresolved disallowed roles.
5. Add regression tests using synthetic fixtures only.

## Research questions

- Can MC preserve interpretive continuity while making source authority inspectable at every layer?
- What is the smallest source boundary schema that prevents accidental privacy leakage without making the interface unusable?
- How should symbolic/private material shape product architecture without becoming public evidence?
- When a source moves from private to public-safe, what revision reason should be logged?
