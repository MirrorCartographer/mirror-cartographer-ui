# Bridge Synthesis — Context Release Profiles

Date: 2026-06-27

Status labels

- Source status: synthesized from public-safe MC architecture notes, File Library snippets, saved context, and current research on contextual integrity and agent memory risk.
- Claim status: bridge synthesis and product hypothesis.
- Privacy status: public-safe; no private household, health, animal-care, financial, relationship, credential, location, or raw transcript material included.
- Missingness: not implemented in runtime; no UX flow, schema validation, or adversarial evaluation yet.
- Revision reason: created to connect MC's internal continuity architecture with external privacy/provenance research.

## Tension

Mirror Cartographer's strength is continuity: it preserves meaning across time.

Mirror Cartographer's risk is also continuity: durable memory can carry private context, over-trusted resonance, or poisoned assumptions into places where they do not belong.

## Bridge claim

The system needs a release layer between `meaning preserved` and `context reused`.

That layer is `ContextReleaseProfile`.

## Distinction

A memory can be:

- meaningful but not shareable.
- shareable but not public.
- public but not actionable.
- actionable but not evidentiary.
- evidentiary for process, but not evidentiary for external truth.

This distinction prevents MC from flattening all preserved context into one permission category.

## Synthesis rule

Preservation and release are separate verbs.

MC may preserve high-resolution private context for the user while releasing only low-resolution method residue to public artifacts.

## Release profile verdicts

- `private_only`: keep inside private continuity.
- `abstract_method_only`: publish the reusable method, not the source content.
- `bounded_collaborator`: share with a specified collaborator role and purpose.
- `professional_prep`: structure for a professional without asserting unsupported conclusions.
- `public_research_safe`: publish as architecture/research/product note.
- `agent_action_blocked`: do not let an agent act from this context.
- `agent_action_allowed_with_guardrails`: allow action only after evidence/privacy/action checks pass.

## Product translation

Add a `ContextReleaseProfile` object before any MC output crosses a boundary.

It should sit after:

- `StateProvenance`
- `EvidenceBoundary`
- `TransitionGate`
- `PublicSafeAbstractionIndex`

and before:

- public GitHub write
- collaborator packet
- external report
- automated task/tool action

## Evaluation question

Can MC preserve rich continuity without creating context leakage?

Success means the public artifact remains useful, specific, and evaluable while the private source remains unexposed.
