# Public-Safe Composition Risk Auditor

## Core finding

Mirror Cartographer needs a **Public-Safe Composition Risk Auditor**: a review layer that evaluates whether individually safe abstractions become unsafe when combined into a larger public artifact, demo, interface, index, test fixture, or implementation plan.

Operating line: **A component can be public-safe alone and still become revealing in composition; safety must be tested at the level of the assembled artifact, not only at the level of each part.**

---

## Source status

- **Private-context material:** Used only to understand MC architecture and the recurring need to transform private context into public-safe methods. No personal, household, health, animal-care, financial, location, relationship, credential, or raw transcript detail is included here.
- **GitHub material:** The active repository and the prior public-safe research note location were checked. The prior note identified publication readiness as a missing higher-order gate. This note extends that finding into post-composition auditing.
- **External/public sources:** Not used. This is a product architecture and governance requirement, not a factual claim about an outside entity.

## Claim status

- **Claim type:** Product governance requirement / evaluation architecture requirement.
- **Claim strength:** Proposed requirement, not validated implementation behavior.
- **Evidence class:** Internal synthesis from MC architectural direction, repository continuity, and prior public-safe publication readiness work.
- **Non-claim boundary:** This note does not claim that any existing MC artifact leaked private information. It defines the audit condition required before combined outputs are treated as publication-safe.

## Privacy status

- **Privacy class:** Public-safe abstraction.
- **Allowed contents:** Audit method, risk labels, evaluation criteria, test requirements, missingness notes, and implementation planning.
- **Disallowed contents:** Raw transcript excerpts, personal examples, household references, health or animal-care details, financial information, locations, credentials, relationship details, or private-context-shaped fixtures.
- **Residual risk:** Medium. Composition risk often appears through adjacency, ordering, repeated motifs, or unusually specific constraint bundles. Mitigation requires whole-artifact review, not only section-by-section redaction.

## Missingness

- Full repository inventory was not available in this run.
- Existing automated privacy tests were not inspected.
- No UI screenshots or generated demos were evaluated.
- No external privacy framework comparison was performed.

## Meaningful revision reason

Prior notes define gates for source rehydration, memory ingestion, traceability, assumption expiry, mode boundaries, interface contracts, fixture boundaries, inference quarantine, abstraction drift, evaluation coverage, synthesis dependencies, and publication readiness. The remaining failure mode is **composition**: a note, demo, UI, or index may pass every local boundary but still reveal too much when the safe fragments are assembled together.

## Product requirement

MC should add a composition-level audit before public release of any artifact that combines multiple public-safe notes, requirements, fixtures, interface labels, synthetic scenarios, or evaluation reports.

The auditor should answer:

1. Does the assembled artifact create a private-context-shaped silhouette even though no single section contains private details?
2. Do repeated labels, sequence, metaphor, or topology imply source material that was intentionally excluded?
3. Does the artifact combine enough constraints to narrow the source too far?
4. Are synthetic fixtures genuinely synthetic at the whole-scenario level, not merely renamed?
5. Does the artifact preserve implementation value without preserving private adjacency?

## Evaluation criteria

A public artifact passes the composition audit only if:

- Each component has source status, claim status, privacy status, missingness, and revision reason labels.
- The assembled artifact has its own composition-level privacy status.
- No cluster of safe fragments reconstructs a disallowed private detail class.
- No artifact order, naming pattern, fixture topology, or motif bundle depends on private-context sequence.
- Any public examples are either synthetic, independently public, or explicitly source-bounded.
- The artifact remains useful without requiring access to private-context interpretation.

## Suggested implementation plan

1. Add a `composition_review` block to public-safe research note templates.
2. Require every public demo or index to list included source classes and excluded source classes.
3. Add a checklist for adjacency risk, sequence risk, motif risk, topology risk, and constraint-bundle risk.
4. Add synthetic-fixture tests that mutate names, ordering, and metaphors; if the fixture still points back to a private source shape, it fails.
5. Add a release gate: no public artifact can move from draft to publication until both local redaction and whole-artifact composition review pass.

## Research questions

- What minimum metadata is needed to detect composition risk without storing sensitive source details?
- Can MC generate high-value synthetic examples that preserve structural behavior while breaking private-context topology?
- Which public-safe notes should be indexed together, and which should remain separated to avoid cumulative disclosure?
- How should the system score repeated motifs that are harmless alone but identifying in aggregate?

## Privacy-safe index tags

- public-safe
- composition-risk
- governance
- evaluation
- publication-readiness
- synthetic-fixtures
- privacy-boundary
- release-gate
