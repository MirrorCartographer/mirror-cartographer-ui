# Public-Safe Section Index and Retrieval Exclusion Rules

## Source status

- Source class: private-context-informed architecture synthesis.
- GitHub source status: repository available; current note is added as an abstract public-safe research artifact.
- Chat/source boundary: private chats, saved context, and prior GitHub research notes were used only to infer system architecture needs. No raw transcript material, personal facts, household facts, health facts, animal-care facts, financial facts, location facts, relationship facts, credentials, or identifying details are included.
- Prior-chain dependency: follows the public-safe section-level revocation and repair target by defining the index layer required for section-specific retrieval, exclusion, repair, and audit.

## Claim status

- Claim type: product requirement and governance architecture proposal.
- Evidence status: architecture-derived; not yet validated against production retrieval logs.
- Confidence: medium-high for design necessity; medium for exact schema until implemented and tested.
- Testability: high. The proposal can be validated by indexing public-safe artifacts at section granularity, simulating revocation/exclusion events, and verifying retrieval behavior.

## Privacy status

- Public-safe: yes, if preserved in this abstract form.
- Private-context exposure risk: low in this note.
- Composition risk: medium. The schema is safe alone, but if populated with private-derived section labels or source-proximal summaries it could become revealing.
- Required guardrail: section IDs must be synthetic and non-semantic unless a section is already independently public-safe.

## Missingness

- No live retrieval logs were inspected.
- No populated section index exists in this note.
- No automated exclusion engine has been implemented here.
- No human review UI is attached yet.
- No empirical false-positive / false-negative exclusion rate has been measured.

## Meaningful revision reason

Prior public-safe notes define revocation, repair, composition risk, claim promotion, and regression sentinels. Those controls remain incomplete unless MC can act below the document level. A document-level allow/block model is too coarse: one unsafe or revoked section should not automatically destroy a whole artifact, but a safe section should also not keep retrieving through a revoked dependency. MC needs section-level indexing plus explicit retrieval exclusion rules.

## Core finding

MC needs a **Public-Safe Section Index and Retrieval Exclusion Rules** layer.

Operating line:

> A public-safe artifact must be retrievable by the smallest meaningful safe unit, and every unit must carry enough boundary metadata to be excluded, repaired, or promoted without silently rehydrating private context.

## Problem

Document-level safety controls create four failure modes:

1. **Over-retention**: a revoked or unsafe section remains retrievable because the surrounding document is still allowed.
2. **Over-deletion**: a mostly safe artifact is removed entirely because one section is contaminated.
3. **Silent rehydration**: a safe-looking section depends on a blocked section but does not carry that dependency forward.
4. **Repair ambiguity**: maintainers cannot tell which exact section needs revision, what rule it violated, or what downstream sections need exclusion until repair is complete.

## Product requirement

Every MC research artifact that enters public-safe retrieval should be decomposed into section records before indexing.

Each section record should include:

- `section_id`: synthetic stable identifier; not derived from private labels.
- `artifact_id`: stable document identifier.
- `section_path`: structural path such as heading order, not private semantic content.
- `section_role`: one of `source_status`, `claim_status`, `privacy_status`, `missingness`, `revision_reason`, `method`, `requirement`, `evaluation`, `research_question`, `implementation_plan`, `index`, `appendix`.
- `source_boundary`: `public_source`, `private_context_abstracted`, `mixed_abstracted`, `unknown`.
- `claim_status`: `observed`, `architecture_inferred`, `hypothesis`, `requirement`, `evaluation_criterion`, `open_question`.
- `privacy_status`: `public_safe`, `public_safe_with_composition_review`, `quarantined`, `revoked`, `blocked`, `unknown`.
- `dependency_ids`: section IDs required to justify or interpret this section.
- `exclusion_reason`: null unless excluded.
- `revision_state`: `current`, `needs_review`, `needs_repair`, `superseded`, `retired`.
- `retrieval_allowed`: boolean derived from rule evaluation, not manually trusted.
- `last_review_reason`: short public-safe explanation.

## Retrieval exclusion rules

A section must be excluded from retrieval when any of the following are true:

1. `privacy_status` is `revoked`, `blocked`, `quarantined`, or `unknown`.
2. `source_boundary` is `unknown` and the section is not explicitly marked as non-substantive metadata.
3. Any dependency in `dependency_ids` is revoked, blocked, or quarantined and no repair note has severed that dependency.
4. `claim_status` is `observed` but the source is private-context-derived and the observation is not abstracted into a method, requirement, evaluation criterion, or research question.
5. The section contains a source-proximal sequence, symbol cluster, scenario shape, or implementation pressure that could reconstruct private context when combined with adjacent sections.
6. The section is part of a superseded artifact and has not been explicitly promoted into a current artifact.
7. The section cannot explain why it is public-safe without referring to hidden personal context.

## Promotion rules

A section may be promoted into public-safe retrieval only when:

1. It has a known source boundary.
2. It has a claim status that matches its evidence.
3. It has passed composition review against neighboring sections.
4. Its dependencies are all retrieval-allowed or explicitly severed by a repair record.
5. It can be summarized without private facts, private topology, or private-derived labels.
6. A reviewer or automated check has recorded a public-safe promotion reason.

## Repair rules

When a section fails review, MC should not only block it. It should create a repair task with:

- failed rule ID;
- affected section ID;
- downstream dependent section IDs;
- proposed repair mode: `generalize`, `split`, `remove_dependency`, `rewrite_as_question`, `downgrade_claim`, `move_to_private`, or `retire`;
- regression test requirement before re-entry.

## Evaluation criteria

A working implementation should pass these tests:

1. **Single-section revocation test**: revoking one section excludes it without deleting unrelated safe sections.
2. **Dependency propagation test**: downstream sections become excluded when their justification depends on a revoked section.
3. **Repair severance test**: a rewritten section can return to retrieval only after its dependency graph no longer points to revoked material.
4. **Composition leak test**: adjacent safe sections are tested together for reconstructive specificity.
5. **Claim downgrade test**: an unsupported observation can be converted into an open research question rather than being falsely promoted.
6. **Index audit test**: every retrieval result can show source status, claim status, privacy status, missingness, and revision reason.

## Implementation plan

1. Add a `PublicSafeSectionRecord` schema.
2. Add a parser that decomposes markdown research notes by heading.
3. Add a rule evaluator that derives `retrieval_allowed` from section metadata.
4. Add dependency propagation so blocked sections recursively quarantine dependent sections.
5. Add repair records rather than overwriting unsafe history.
6. Add retrieval filters that default to `retrieval_allowed = true`.
7. Add an audit view that can explain why any section was included or excluded.

## Research questions

- What is the smallest meaningful retrieval unit for MC: heading section, paragraph, claim, schema field, or evaluation criterion?
- How should MC detect reconstructive specificity across multiple individually safe sections?
- Should section IDs be content-hashed, random, or structure-derived?
- How can a future AI assistant use the section index without learning private-derived topology from excluded records?
- What is the correct retention policy for excluded metadata that is needed for audit but unsafe for synthesis?

## Public-safe index entry

- Title: Public-Safe Section Index and Retrieval Exclusion Rules
- Type: architecture requirement
- Status: proposed
- Privacy: public-safe abstract
- Depends on: section-level revocation and repair; transitive dependency revocation; regression sentinel; redaction evidence binder
- Next target: public-safe retrieval audit trail and answer-time source boundary display
