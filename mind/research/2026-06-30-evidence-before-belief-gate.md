# Evidence-Before-Belief Gate

## Public-safe finding
Mirror Cartographer needs an explicit gate between available context, derived claim, and model response. The system should not allow remembered context, symbolic coherence, user resonance, or repeated language to become a public claim until the supporting evidence class, claim type, privacy class, missingness, and revision reason are labeled.

## Core phrase
Evidence enters before belief. Belief exits only after boundary inspection.

## Source status
- File Library: available, partial, public-safe abstraction only.
- Saved/context memory: used only for architectural orientation; no protected details copied.
- GitHub connector: repository available with push permission; root README not confirmed through fetch in this run.
- Web research: current public sources reviewed for memory/provenance/trust-boundary alignment.

## Claim status
- Claim type: product architecture requirement.
- Confidence: medium-high for need; medium for exact implementation shape.
- Support basis: MC materials already describe provenance, reasoning trajectory, symbolic reflection, contradiction preservation, and non-authority boundaries; current AI-memory research supports evidence/provenance separation and memory admission gates.

## Privacy status
- Public-safe: yes.
- Contains personal details: no.
- Contains household, health, animal-care, financial, location, relationship, credential, or raw transcript details: no.
- Private context handling: abstracted only into method-level requirements.

## Missingness
- No complete repo-wide code audit was available in this run.
- Root README fetch returned unavailable/not found, so repository-state claims remain bounded.
- No claim is made that this gate is implemented in production.

## Revision reason
Previous MC mind passes established source boundaries, claim transport, context admission, quarantine, temporal validity, contestability, and deployment boundaries. This pass revises the architecture by inserting a stricter pre-claim separation layer: evidence must be stored, classified, and inspected before any belief-like output is allowed to stabilize.

## Product requirement
Create an Evidence-Before-Belief Gate that receives candidate context and outputs a release decision:

1. `evidence_recorded`: source class exists before claim synthesis.
2. `evidence_scope`: private, public, mixed, synthetic, unknown, or absent.
3. `claim_class`: fact, inference, product requirement, symbolic interpretation, speculation, evaluation, or implementation note.
4. `belief_pressure`: low, medium, or high risk that the model is treating repetition/coherence/resonance as proof.
5. `privacy_clearance`: public-safe, internal-only, blocked, or needs distillation.
6. `missingness_label`: complete enough, partial, stale, contradicted, or unknown.
7. `release_verdict`: publish, publish-with-boundary, quarantine, revise, or block.

## Research questions
- How should MC preserve evidence lineage without exposing private source material?
- What minimum evidence labels are necessary before a public artifact can be created?
- How can symbolic resonance be preserved while preventing it from being mistaken for factual support?
- What UI should show users the difference between what shaped an answer and what proves an answer?
- How should the system handle useful but non-publishable private influence?

## Evaluation criteria
A passing output must:
- identify source class before claim class;
- separate evidence, inference, interpretation, and release decision;
- label private influence without exposing it;
- avoid diagnostic, legal, financial, or authority overreach;
- state missingness when evidence is partial;
- preserve contradiction instead of smoothing it away;
- include a revision reason when the claim changes;
- make public claims accountable without making private sources public.
