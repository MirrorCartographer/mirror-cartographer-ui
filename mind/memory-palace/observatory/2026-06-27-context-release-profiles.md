# Observatory Note — Context Release Profiles

Date: 2026-06-27

Status labels

- Source status: derived from public-safe inspection of available Mirror Cartographer context, File Library snippets, saved architectural context, and current external research on agent memory/privacy.
- Claim status: research synthesis and architecture requirement, not a completed implementation or legal/privacy guarantee.
- Privacy status: public-safe abstraction only; private context was used only to understand architectural pressure and is not reproduced here.
- Missingness: needs implementation design, consent UX review, red-team testing, and comparison against existing memory/control interfaces.
- Revision reason: added after prior MC mind entries established provenance, transition gates, evidence boundaries, and public-safe abstraction indexes; this note isolates the release-layer problem.

## Research question

How should Mirror Cartographer decide what kind of context can safely move from private symbolic continuity into public, collaborative, research, product, or agent-action settings?

## Public-safe internal finding

Available MC materials repeatedly define the system as a continuity/provenance layer rather than a simple journal or output tool. The reusable public method is not the private life content. The reusable method is the structured conversion of lived/symbolic state into bounded, labeled, inspectable context.

The next missing primitive is a `ContextReleaseProfile`: a small object attached to any MC memory, reflection, artifact, or claim before it is shown outside its original context.

## External research pressure

Current agent-memory research strengthens this need:

- Persistent AI memory increases continuity and personalization, but creates durable privacy, poisoning, and provenance risks.
- Local-first and zero-trust memory architectures emphasize per-memory provenance, isolation, trust scoring, and governance layers.
- Contextual-integrity work frames privacy as appropriate information flow, not just secrecy or deletion.
- Memory poisoning research shows that aggressive memory writing/retrieval can increase exploitability; therefore MC should treat memory release as an explicit state transition, not an automatic convenience.

## MC-specific synthesis

MC already separates symbolic salience, factual certainty, privacy boundaries, and transition gates. `ContextReleaseProfile` adds the missing release decision:

- Who/what is receiving the context?
- What role is the receiver playing?
- What type of information is being transferred?
- What is the permitted transmission principle?
- What abstraction level is safe?
- What must be removed, generalized, or retained only as private source?
- What downstream action is allowed?

## Product requirement

Every externally reusable MC artifact should be able to answer:

> What survived abstraction, what was intentionally withheld, and what is this output allowed to do?

## Architectural implication

MC should not have one global memory switch.

It needs context-sensitive release profiles for different exits:

- private self-reflection
- AI coauthor reasoning
- clinician/vet/legal/professional prep
- public research note
- GitHub mind entry
- product requirement
- collaborator packet
- automated agent action

The same source event may produce different safe outputs depending on the release profile.

## Non-goals

- Do not publish raw transcripts.
- Do not convert resonance into proof.
- Do not let a public artifact imply access to private source.
- Do not permit automated agent action merely because a symbolic pattern feels important.

## Open test

Can a reviewer evaluate an MC public artifact's method, privacy boundary, evidence boundary, and action boundary without seeing the private source that produced it?
