# Public-Safe Source Rehydration Gate

Status labels

- Source status: derived from available MC file-library summaries, connected GitHub repository metadata, and verified existing GitHub index content.
- Claim status: product-governance requirement and implementation plan, not a claim that the gate already exists in runtime code.
- Privacy status: public-safe abstraction. Contains no raw transcript text, personal details, household details, health details, animal-care details, financial details, location details, relationship details, credentials, or private identifiers.
- Missingness: prior automation responses named several recent `mind/research` artifacts and commit IDs, but those specific paths and commit messages were not discoverable in the connected repository during this run. Treat them as unverified until independently fetched.
- Revision reason: created because the MC research loop needs a rule for safely converting private-context understanding back into public artifacts without reattaching private source material.

## Core finding

MC needs a Public-Safe Source Rehydration Gate.

Operating line:

A public artifact may use private context to understand architecture, but it must not rehydrate private source material into public evidence, examples, labels, screenshots, demos, or implementation fixtures.

## Problem

MC uses private context, saved memory, uploaded documents, and GitHub materials to build a coherent architecture.

That creates a recurring risk:

- private material is abstracted once,
- the abstraction becomes a public requirement,
- later implementation tries to make the requirement concrete again,
- concrete examples accidentally pull private source shape back into the public artifact.

This is not only a redaction problem.

It is a rehydration problem: the private signal can return later through examples, tests, UX labels, fixture names, demos, screenshots, or overly specific evaluation cases.

## Gate definition

Before any public MC artifact is published, reused, implemented, tested, or demonstrated, it must pass a source rehydration gate.

The gate asks:

1. Did this artifact originate from private, mixed, public, synthetic, or unknown source material?
2. Does the public version preserve only method, structure, requirement, question, criterion, or plan?
3. Does any example, fixture, screenshot, label, or interface copy resemble a private source too closely?
4. Could a later maintainer infer hidden personal context from this public artifact?
5. Is the evidence label still accurate after abstraction?
6. Is the claim strength weaker, equal, or stronger than the underlying source can justify?
7. Is there a safe synthetic substitute for every concrete case?
8. Is the missingness explicit?

## Required source classes

Allowed source status values:

- public_verified
- public_unverified
- private_context_used_for_architecture_only
- mixed_source_public_safe_abstraction
- synthetic_fixture
- connected_repo_verified
- file_library_summary_only
- unavailable_or_missing
- unknown

## Required privacy classes

Allowed privacy status values:

- public_safe
- public_safe_with_source_boundary_note
- private_only
- mixed_requires_abstraction
- blocked_from_publication
- synthetic_only
- unknown_requires_review

## Required claim classes

Allowed claim status values:

- observation
- design_principle
- product_requirement
- research_question
- evaluation_criterion
- implementation_plan
- governance_rule
- unverified_memory
- contradiction_preserved
- blocked_or_missing

## Rehydration risk checklist

Flag the artifact if it contains any of these:

- real names or identifiers
- raw transcript phrasing
- real household or relationship structure
- health or care facts
- animal-care facts
- financial facts
- location-specific clues
- credentials or account details
- exact chronology from private life
- screenshots derived from private sources
- examples that mirror private facts too closely
- fixtures named after private symbols without explicit synthetic status
- interface labels that imply private evidence is public evidence

## Safe transformation pattern

Private source shape must be converted as follows:

- raw event -> abstract interaction pattern
- personal detail -> source-boundary note
- care-adjacent fact -> non-clinical reflection boundary
- financial fact -> excluded from public artifact unless fully generalized
- implementation mistake -> governance test
- contradiction -> contradiction class, not exposed content
- recurring symbol -> synthetic motif class unless user explicitly publishes it
- private timeline -> maturity stage or revision reason
- account/tool problem -> missingness or connector limitation note

## Product requirement

Every MC public artifact should include a short source boundary block:

- source_status
- claim_status
- privacy_status
- missingness
- revision_reason
- rehydration_risk
- safe_next_action

## Evaluation criteria

A public artifact passes this gate when:

1. It can be understood without private context.
2. It does not expose or imply private source material.
3. It states whether its source was public, private, mixed, synthetic, missing, or unknown.
4. It does not use private source material as public evidence.
5. It offers synthetic examples when examples are needed.
6. It preserves architectural value without personal leakage.
7. It records meaningful missingness instead of fabricating continuity.
8. It can be implemented by another contributor without access to private transcripts.

## Implementation plan

1. Add a reusable markdown template for public-safe source boundary blocks.
2. Add a repository lint checklist for `mind/`, `docs/`, demos, and fixtures.
3. Require synthetic fixtures for public demos and regression tests.
4. Mark all unverified prior automation-created paths as missing until fetched.
5. Separate private-context understanding from public-source evidence in every research note.
6. Add a rehydration-risk field to future contrast records.

## Research questions

- What is the minimum abstraction that preserves MC's architecture without leaking the private source shape?
- How can synthetic fixtures stay emotionally and structurally representative without becoming disguised private examples?
- Which MC interface surfaces are most likely to rehydrate private source material: labels, examples, exports, diagrams, tests, or demos?
- How should the system demote a finding when the claimed GitHub source cannot be fetched?

## Meaningful revision reason

This note revises the current public-safe research loop by adding a missing stage between redaction and implementation.

Redaction removes unsafe source material.

The Source Rehydration Gate prevents that material from returning later through concrete implementation choices.
