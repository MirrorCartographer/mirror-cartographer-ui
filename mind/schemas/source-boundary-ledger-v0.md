# SourceBoundaryLedger v0

Status labels

- Source status: schema derived from public-safe MC architecture research and current provenance/transparency alignment.
- Claim status: implementation schema proposal, not deployed software.
- Privacy status: public-safe abstraction; no raw source material.
- Missingness: no parser, UI, database table, tests, or enforcement layer yet.
- Revision reason: created as the next concrete organ after `Provenance as Architecture`.

## Purpose

A SourceBoundaryLedger lets MC preserve the transformation path of an artifact without exposing private context.

It answers:

- Where did this come from?
- What kind of claim is it?
- What was transformed?
- What is safe to publish?
- What is missing?
- What should future readers not assume?

## Minimal record

### artifact_id

Stable name or path.

### artifact_title

Human-readable title.

### artifact_lifecycle_state

One of:

- seed
- growing
- tested
- museum-worthy
- dormant
- extinct
- rediscovered

### source_classes

Allowed values:

- public_web
- public_repository
- private_file_context
- saved_memory
- active_conversation
- inference
- creative_speculation
- tool_output
- user_instruction

### release_class

Allowed values:

- private_only
- public_safe_abstraction
- public_artifact
- blocked_contrast_only
- rejected

### claim_classes

Allowed values:

- fact
- source_backed_claim
- inference
- design_hypothesis
- metaphor
- speculative_bridge
- implementation_requirement
- evaluation_criterion
- product_requirement

### transformation_classes

Allowed values:

- copied
- summarized
- abstracted
- anonymized
- generalized
- reframed
- safety_revised
- blocked_original_preserved_privately
- blocked_original_not_preserved

### privacy_constraints

List what cannot be exposed.

Disallowed public classes include:

- personal details
- household details
- health details
- animal-care details
- financial details
- location details
- relationship details
- credential details
- raw transcript details
- private account details

### missingness

Required free-text section.

Must state what is not known, not validated, or not implemented.

### revision_reason

Required free-text section.

Must state why this artifact exists or changed.

### contrast_pointer

Optional.

Points to a private-only or blocked contrast record if appropriate.

Never include private content directly in a public artifact.

## Example record

artifact_id: mind/research/2026-06-27-provenance-as-architecture.md

artifact_lifecycle_state: growing

source_classes:

- private_file_context
- saved_memory
- public_web
- existing_repository_mind

release_class: public_safe_abstraction

claim_classes:

- design_hypothesis
- product_requirement
- implementation_requirement
- evaluation_criterion

transformation_classes:

- abstracted
- generalized
- reframed

privacy_constraints:

- no raw transcript excerpts
- no personal case details
- no health or animal-care specifics
- no account or credential details

missingness:

No working ledger implementation, no UI, no validation tests, no formal legal review.

revision_reason:

Created to convert recurring research into a durable provenance architecture direction.

contrast_pointer:

none

## Enforcement rule

No artifact should be treated as public-safe merely because it is useful.

It becomes public-safe only after release class, claim class, privacy constraints, and missingness are explicitly labeled.
