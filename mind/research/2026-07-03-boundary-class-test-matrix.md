# Boundary-Class Test Matrix

Date: 2026-07-03
Status: public-safe research note
Repository area: mind/research

## Core finding

Mirror Cartographer needs a Boundary-Class Test Matrix.

Operating line:

> A public reflection should prove what class of source it came from, not which private source it came from.

## Source status

- Source class: mixed private-context-derived architecture, uploaded public-facing MC documents, and repository availability check.
- Publicly publishable source material: only abstracted architecture language, product requirements, evaluation criteria, and implementation plans.
- Non-publishable source material: raw chat transcripts, personal anecdotes, household details, health or animal-care details, relationship details, financial details, credentials, locations, private identifiers, and any exact transcript-derived examples.
- Repository status: `MirrorCartographer/mirror-cartographer-ui` is accessible for writing. A separate `mirror-cartographer-next` repository was not accessible in this run.

## Claim status

- Claim type: product-safety architecture requirement.
- Claim strength: design recommendation, not empirical validation.
- Evidence basis: recurring MC architecture pattern in which private lived context can inspire system requirements, but public artifacts must remain detached from private origin.
- External validation required: yes. The matrix should be tested against synthetic examples and reviewed by privacy, safety, and product-design readers before being treated as a release gate.

## Privacy status

Public-safe.

This note contains no personal, household, health, animal-care, financial, location, relationship, credential, or raw transcript details. It only describes an abstract method for classifying whether a public artifact has preserved the correct source boundary.

## Missingness

- No full repository tree was available through the current connector result, so this note does not claim integration with existing code paths.
- No exhaustive audit of all MC files was completed in this run.
- No empirical user study is attached.
- No automated linter implementation is included yet.

## Revision reason

Previous research notes established boundary, provenance, evidence-tier, missingness, synthetic-example, and derivation rules. The remaining gap is testability: a system can state privacy-safe principles while still lacking a concrete pass/fail matrix for publication review.

This note turns the boundary principle into a test matrix that can be used by humans or future automation.

## Product requirement

Before any MC-derived public artifact is published, it must be classified by boundary class and checked against allowed output properties.

### Boundary classes

1. Private-Origin / Public-Abstraction
   - Allowed: abstract methods, generalized requirements, anonymized evaluation criteria, generalized research questions.
   - Forbidden: identifiable examples, transcript fragments, specific biographical details, private event sequences.

2. Public-Document / Public-Summary
   - Allowed: summaries of explicitly public or user-approved public-facing documents.
   - Forbidden: adding private context to make the public summary more dramatic or specific.

3. Synthetic / Public-Test
   - Allowed: invented examples designed to test system behavior.
   - Forbidden: examples that are thinly disguised private events.

4. Repo-Native / Implementation
   - Allowed: code, schemas, docs, tickets, test cases, interface plans.
   - Forbidden: secrets, credentials, raw private chat exports, private health or household references.

5. Unknown-Origin / Quarantine
   - Allowed: source-boundary note, missingness statement, request for verification.
   - Forbidden: publication as knowledge, product claim, evaluation result, or user-facing proof.

## Evaluation matrix

Each candidate public artifact must answer:

1. What source class produced this artifact?
2. What exact private details were excluded?
3. Can the artifact be understood without private context?
4. Can the artifact be traced to a boundary class without tracing to a person or event?
5. Is the claim labeled as hypothesis, requirement, observation, implementation plan, or validated result?
6. Is missingness named explicitly?
7. Is there a revision reason explaining why this artifact exists now?
8. Would the artifact remain safe if copied outside the repository?
9. Would a synthetic example be sufficient to demonstrate the same point?
10. If no, should the artifact be quarantined instead of published?

## Pass/fail rule

An artifact passes only if:

- It identifies source class.
- It identifies claim status.
- It identifies privacy status.
- It identifies missingness.
- It avoids private-detail leakage.
- It remains useful without private context.
- It can be tested with synthetic examples.

An artifact fails if it requires private context to feel convincing.

## Implementation plan

1. Add a frontmatter schema for MC research notes:
   - `source_status`
   - `claim_status`
   - `privacy_status`
   - `missingness`
   - `revision_reason`
   - `boundary_class`

2. Add a publication checklist template.

3. Create synthetic examples for each boundary class.

4. Add a lightweight lint script that fails notes missing required labels.

5. Add a human review step for any artifact derived from private-context architecture.

## Research questions

- How much abstraction is enough for private-origin public methods?
- Can a public artifact be useful if all emotionally vivid private examples are removed?
- What is the minimum provenance record needed to preserve trust without leaking identity?
- Can synthetic examples fully replace private examples for evaluation?
- How should MC label uncertainty when source material is partial, remembered, exported, or mixed?

## Public-safe index entry

Boundary-Class Test Matrix: a publication-safety method for ensuring MC artifacts disclose the class of source and strength of claim while preventing private-source reconstruction.
