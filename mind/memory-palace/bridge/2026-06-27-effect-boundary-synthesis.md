# Bridge Synthesis — EffectBoundary

Date: 2026-06-27

Status labels

- Source status: synthesized from public-safe MC architecture notes and external research on provenance, AI risk management, agent observability, and privacy-aware reasoning.
- Claim status: bridge synthesis and product hypothesis.
- Privacy status: public-safe abstraction; no raw private context included.
- Missingness: not yet implemented, tested, or validated against real user sessions.
- Revision reason: added to connect MC's existing source / claim / privacy / transition boundaries with downstream effect control.

## Inner-world claim

Mirror Cartographer is not complete if it only maps meaning.

It also needs to map what a meaning is allowed to do.

## Research-world pressure

Provenance standards support tracking production lineage so trustworthiness can be assessed.

AI risk frameworks emphasize design-time and use-time evaluation rather than treating a generated output as the whole risk surface.

Agent research shows that risk can emerge from reasoning traces, tool use, contextual drift, and downstream actions even when the final answer is clean.

## Conflict

MC's value comes from symbolic intensity.

But symbolic intensity is also what can create unsafe amplification if it is reused as fact, proof, diagnosis, identity, persuasion, publication material, or action instruction.

## Synthesis

The bridge is EffectBoundary.

EffectBoundary separates:

1. Felt effect: how strongly the reflection lands.
2. Symbolic effect: what pattern or metaphor it strengthens.
3. Memory effect: whether it can update future interpretation.
4. Public effect: whether it can become public method residue.
5. Action effect: whether it can influence real-world behavior.
6. Evidence effect: whether it can support any factual claim.

A reflection's emotional or symbolic effect must not automatically grant it factual, public, or action authority.

## Bridge verdict

- Preserve: MC's symbolic richness and resonance feedback.
- Refine: resonance must be routed through effect boundaries before persistence or publication.
- Split: felt usefulness, symbolic salience, factual evidence, public release, and action permission are distinct layers.
- Test: compare sessions with and without EffectBoundary for privacy leakage, overclaiming, and unsupported action escalation.
- Product translation: implement an `EffectBoundary` object and an `AmplificationGate` verdict before memory reuse, export, publication, or external action.

## New light

The important safety unit is not only the source, claim, or transition.

It is also the effect.

MC should ask: not only what does this mean, but what is this meaning allowed to become?
