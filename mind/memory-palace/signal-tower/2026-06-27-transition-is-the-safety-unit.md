# Signal — Transition Is the Safety Unit

Date: 2026-06-27

Status labels

- Source status: derived from public research scan and current MC architecture pass.
- Claim status: candidate recurring signal.
- Privacy status: public-safe abstraction.
- Missingness: needs repeated testing across future MC artifacts and runtime implementation.
- Revision reason: the run identified intermediate-flow safety as the next architecture layer after release profiles and evidence boundaries.

## Signal

The artifact is not the only safety unit.

The transition is the safety unit.

## Meaning

MC should not ask only, `Is this final output safe?`

It should also ask:

- What source layer did this come from?
- What layer is it moving into?
- What changed during the move?
- What claim strength changed?
- What privacy class changed?
- What detail classes were blocked?
- What downstream uses are now allowed or forbidden?

## Why it matters

A private symbolic state may be valid inside reflection.

The same state may become unsafe if moved into public explanation without abstraction.

The same state may become misleading if moved into evidence language without downgrading claim status.

The same state may become harmful if moved into action without a transition gate.

## Current strength

Candidate signal.

It aligns with prior MC objects:

- StateProvenance
- TransitionGate
- ResonanceEvent
- EvidenceBoundary
- PublicSafeAbstractionIndex
- ContextReleaseProfile

But it needs implementation and adversarial tests before being elevated.

## Confirmation test

Create several MC artifacts from sensitive mock inputs and check whether `SymbolicFlowLedger` prevents reconstruction of private source while preserving reusable method.
