# Observatory Note — Consent-Aware State Transitions

Date: 2026-06-27

Status labels

- Source status: public-safe synthesis from prior MC mind entries, saved architectural context, and current external research scan.
- Claim status: research-informed product requirement, not a completed implementation.
- Privacy status: public-safe abstraction only; no personal, household, health, animal-care, financial, location, relationship, credential, or raw transcript details included.
- Missingness: needs code-level design review, threat modeling, and user testing.
- Revision reason: added after the prior `Dream Then Test` and `StateProvenance` work exposed a missing transition layer between symbolic reflection and product action.

## Research question

How should Mirror Cartographer decide when a symbolic state can become an external action, a product requirement, a research claim, or a private-only reflection?

## Public research anchors

- W3C PROV frames provenance as information about entities, activities, and agents involved in producing data or things, useful for assessing quality, reliability, and trustworthiness.
- Recent agentic-memory research emphasizes persistent memory, structured user modeling, provenance, isolation, and defenses against memory poisoning.
- Recent privacy-auditing research for AI agents argues that runtime behavior should be checked against stated privacy policies, because agents may collect or disclose sensitive local data without sufficient transparency.
- Recent AI-governance work increasingly treats agentic systems as requiring continuous, verifiable governance rather than one-time policy statements.

## Finding

MC needs a transition protocol, not only a memory protocol.

A symbolic reflection may be valuable, but value alone does not authorize externalization.

A state should move outward only when it passes a boundary check:

1. What kind of state is this?
2. What source produced it?
3. What claim does it make?
4. What privacy class does it contain?
5. What transformation is being requested?
6. What evidence supports the transformation?
7. What external surface will receive it?
8. What harm occurs if the transformation is wrong?

## Core distinction

A private symbolic state can be meaningful without being publishable.

A publishable method must be abstracted away from the private state that produced it.

A product action must be grounded in a method, not in exposed private content.

## Implication for MC

Every state transition should be typed:

- reflection_to_private_memory
- reflection_to_public_method
- reflection_to_research_question
- reflection_to_product_requirement
- reflection_to_external_action
- reflection_to_no_save

The transition type controls what data may move forward.

## Boundary rule

Do not publish the event.

Publish the method extracted from the event.

Do not publish the private example.

Publish the source-boundary note that explains what kind of evidence would be needed to validate the method.
