# Attractor: Deployment Boundary

## Name

Deployment Boundary

## Core phrase

A product is not public because it exists. It is public when its boundary has been proven.

## Field pressure

MC has developed strong privacy, claim, memory, source, and context-boundary concepts. The next pressure point is product reality: users, funders, auditors, or maintainers may read a public artifact and assume that a designed capability exists in production.

The Deployment Boundary attractor prevents that collapse.

## What it pulls toward

- Separate status for design, repository, build, deployment, runtime, and configuration.
- Dated verification.
- Public-safe proof.
- Explicit missingness.
- Revision reasons.
- No secrets, raw setup logs, or private screenshots as public proof.

## What it repels

- "It exists" used to mean "it works."
- "It is in GitHub" used to mean "it is deployed."
- "It deployed once" used to mean "it is current."
- "A screenshot showed it" used to mean "safe public proof."
- "The environment was configured" used to mean "safe to reveal."

## Relation to prior attractors

- Source Boundary: deployment proof must not expose private source material.
- Claim Transport: deployment claims need a transport record.
- Temporal Validity: deployment state expires and must be rechecked.
- Context Quarantine: private setup traces may inform architecture without entering public release.
- Compression Loss: summarized deployment status must state what was lost or unverified.

## Release rule

Before MC says a feature is public, deployed, live, or working, it must cross the Deployment Boundary Ledger.
