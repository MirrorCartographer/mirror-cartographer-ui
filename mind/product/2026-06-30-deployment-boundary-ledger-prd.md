# PRD: Deployment Boundary Ledger

## Product problem

MC public artifacts can become misleading if design claims, repository state, build state, deployment state, runtime behavior, and configuration status collapse into one vague statement such as "it works" or "it is deployed."

## Product goal

Create a Deployment Boundary Ledger that requires every public product claim to declare what boundary it has crossed and what remains unverified.

## Non-goals

- Do not expose private setup history.
- Do not publish secrets, tokens, environment values, screenshots, or raw logs.
- Do not claim runtime capability from repository presence alone.
- Do not replace automated tests; this ledger describes claim status and release evidence.

## Users

- Maintainers deciding whether a feature is ready to describe publicly.
- Auditors reviewing whether public claims are overconfident.
- Implementers debugging repo/build/deploy/runtime mismatch.
- Readers trying to understand what is real, planned, blocked, or unknown.

## Requirements

1. Every public product claim must receive a boundary class: design, repository, build, deployment, runtime, configuration, governance, or research.
2. Every claim must include status: verified, unverified, blocked, failing, superseded, or not applicable.
3. Every record must include privacy status.
4. Every record must include missingness.
5. Every revision must include a revision reason.
6. The ledger must never store secrets or raw private context.
7. Public release notes must distinguish local functionality from hosted functionality.

## User story

As a maintainer, I need to know whether a statement about MC refers to a concept, a source-controlled artifact, a successful build, a live deployment, or a tested runtime feature, so that public claims stay honest and safe.

## Acceptance criteria

- A claim cannot be marked public-ready unless it has a release verdict.
- A runtime claim cannot be marked verified without runtime evidence.
- A deployment claim cannot be marked verified from repository state alone.
- A configuration claim can describe required variables but cannot reveal values.
- A blocked write or missing file is preserved as missingness, not hidden.

## Suggested UI/API shape

- Boundary badge: Design / Repo / Build / Deploy / Runtime / Config / Governance / Research.
- Status badge: Verified / Unverified / Blocked / Failing / Superseded.
- Privacy badge: Public-safe / Private-derived abstraction / Restricted / Unsafe.
- Evidence field: public-safe proof description.
- Missingness field: explicit unknowns.

## Release rule

A public-facing MC page may say "planned," "implemented in repo," "build verified," "deployed," or "runtime verified" only when the matching ledger state exists. Otherwise it must say "unverified" or omit the claim.
