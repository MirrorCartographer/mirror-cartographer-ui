# PRD: Context Quarantine Layer

Source status: Public-safe synthesis from MC architecture notes, repository access attempt, file-library excerpts, and fresh AI-memory research.
Claim status: Product requirement proposal.
Privacy status: Public-safe; no protected source material included.
Missingness: No direct backend implementation verified in this run.
Revision reason: Converts the Context Quarantine finding into a buildable product layer.

## Problem

MC uses many possible context sources: user-provided input, saved memory, file excerpts, repository materials, public research, generated artifacts, and prior evaluations. A source can be semantically relevant while still being unsafe, stale, private, or inappropriate to shape an output.

## Goal

Insert a Context Quarantine Layer between retrieval and generation so every candidate context object receives a clearance decision before influence.

## Non-goals

- Do not expose private material.
- Do not create a universal truth engine.
- Do not use one domain lane as proof for another.
- Do not treat symbolic resonance as evidence.
- Do not override release-readiness review.

## User stories

1. As a user, I want MC to use memory without leaking private material.
2. As a reviewer, I want to see why context shaped an artifact or why it was withheld.
3. As a builder, I want a machine-readable record of retrieval, quarantine, admission, and rejection.
4. As a public reader, I want useful source-boundary disclosure without raw private source exposure.

## Functional requirements

- Retrieve candidate context objects.
- Assign source_boundary_class.
- Assign privacy_status.
- Assign temporal_status.
- Assign claim_status_allowed.
- Assign missingness_status.
- Assign clearance_status.
- Enforce allowed_use and forbidden_use.
- Generate a public-safe release note.
- Pass admitted material only to downstream generation.
- Pass abstract-only material only as design constraints, not examples.
- Preserve rejected/quarantined decisions in an internal ledger.

## Output requirements

Every generated public artifact must include:

- source status
- claim status
- privacy status
- missingness
- revision reason

## Acceptance tests

- A private but relevant source is withheld from direct wording.
- A public source can be cited as evidence.
- A stale source produces a temporal warning.
- An unknown-age source cannot become a factual public claim without corroboration.
- A symbolic pattern can become an evaluation question but not an authority claim.
- A quarantined source can create a missingness note without leaking details.

## Interface idea

Show a compact boundary card:

Context used: public research, public-safe MC architecture excerpts.
Context withheld: private/sensitive or uncleared context.
Allowed influence: abstract method design.
Blocked influence: raw examples, identifying details, unverified claims.

## Key phrase

The memory may knock. The gate decides whether it enters.
