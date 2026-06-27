# Signal — Layer Transitions

Date: 2026-06-27

Status labels

- Source status: derived from current public-safe MC research/write pass and existing method notes.
- Claim status: candidate recurring signal.
- Privacy status: public-safe abstraction only.
- Missingness: needs future implementation testing.
- Revision reason: added because Dream Then Test, StateProvenance, and TransitionGate all point to the same design pattern.

## Signal

A move between layers should be treated as a design event.

The relevant layers are:

- symbolic layer
- source layer
- claim layer
- research layer
- product layer
- code layer
- public artifact layer

## Why it matters

MC's useful output is not just a captured note.

It is the controlled transformation of a note into a method, interface, requirement, test, or build task.

That transformation must keep source boundaries visible.

## Current strength

Candidate signal.

It appears across three nearby structures:

- Dream Then Test separates creative formation from evidence encounter.
- StateProvenance separates source, claim, privacy, and missingness.
- TransitionGate separates meaning from outward movement.

## Product consequence

Future MC data design should represent transitions as first-class records.

Entries answer: what was captured?

Transitions answer: what changed, where did it move, and what boundary allowed it?

## Next confirmation test

Run three unrelated MC outputs through TransitionGate.

Measure whether the protocol improves clarity, boundary safety, and build-readiness without reducing symbolic specificity.
