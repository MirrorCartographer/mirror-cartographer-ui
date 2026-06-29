# Deployment Boundary Record v0

## Purpose

A public-safe record for separating design intent, repository state, build state, hosted deployment state, runtime verification, and configuration boundaries.

## Required fields

- record_id: stable identifier.
- created_at: ISO date.
- source_status: one of private-context-informed, file-informed, repo-informed, web-informed, mixed, unknown.
- claim_status: one of design-proposal, requirement, verified-repo-state, verified-build-state, verified-deployment-state, verified-runtime-state, blocked, unknown.
- privacy_status: one of public-safe, private-source-derived-public-abstraction, restricted, unsafe-to-publish.
- artifact_claim: the public-facing claim being evaluated.
- design_intent: what the artifact is intended to do.
- repository_state: verified, unverified, missing, blocked, not-applicable.
- build_state: passing, failing, unverified, blocked, not-applicable.
- deployment_state: passing, failing, unverified, blocked, not-applicable.
- runtime_state: passing, failing, unverified, blocked, not-applicable.
- config_boundary: public-safe description of environment/config needs; no secrets.
- proof_boundary: acceptable proof types and disallowed proof types.
- missingness: what is unknown or unverified.
- revision_reason: why this record exists or changed.
- release_verdict: publish, hold, revise, reject.

## Prohibited content

Do not include:

- API keys or environment variable values.
- raw transcripts.
- private screenshots.
- account identifiers.
- personal, household, health, animal-care, financial, location, relationship, or credential details.
- precise local file paths if they identify a person or private machine state.

## Minimal example

record_id: deployment-boundary-example-001
created_at: 2026-06-30
source_status: mixed
claim_status: design-proposal
privacy_status: public-safe
artifact_claim: MC has a deployment boundary audit layer.
design_intent: separate design, repo, build, deploy, runtime, and configuration states.
repository_state: unverified
build_state: unverified
deployment_state: unverified
runtime_state: unverified
config_boundary: requires environment configuration, values not disclosed.
proof_boundary: public release notes may show status labels, not secrets or private setup logs.
missingness: repo tree and hosted runtime not verified in this record.
revision_reason: prevent repository existence from being conflated with public runtime capability.
release_verdict: publish
