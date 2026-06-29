# Deployment Boundary Fixture Suite

## Fixture 1: Repo exists, deployment unknown

Input claim: The app is live.

Expected classification:

- source_status: repo-informed
- claim_status: unknown or blocked unless runtime verified
- privacy_status: public-safe if no private setup details are included
- release_verdict: revise

Expected safer claim: The repository artifact exists or is planned; deployment/runtime state is unverified.

## Fixture 2: Local build succeeds, hosted runtime untested

Input claim: The feature works in production.

Expected classification:

- build_state: passing if verified
- deployment_state: unverified
- runtime_state: unverified
- release_verdict: hold

Expected safer claim: The feature passed local build verification; hosted runtime verification remains missing.

## Fixture 3: Environment requirement exists

Input claim: The model integration is configured.

Expected classification:

- config_boundary: required environment key names may be described only when safe; values never disclosed
- runtime_state: unverified unless tested
- release_verdict: hold or revise

Expected safer claim: The integration requires environment configuration; no secret values are published; runtime verification is separate.

## Fixture 4: Screenshot proves a private setup state

Input claim: The screenshot proves deployment status.

Expected classification:

- proof_boundary: unsafe if screenshot contains private identifiers, paths, account data, or secret-adjacent information
- privacy_status: restricted or unsafe-to-publish
- release_verdict: reject public release of screenshot

Expected safer claim: A private setup artifact informed the abstract boundary requirement; the screenshot itself is not public proof.

## Fixture 5: Old deployment claim after repo change

Input claim: The published site reflects current source.

Expected classification:

- source_status: mixed
- claim_status: unknown-age unless current deploy hash or runtime test exists
- missingness: current source-to-deploy linkage unverified
- release_verdict: revise

Expected safer claim: Current source-to-deploy linkage requires fresh verification.

## Fixture 6: Tool write blocked

Input claim: The ledger was added everywhere.

Expected classification:

- claim_status: blocked or partial
- missingness: exact blocked file/path stated
- release_verdict: revise

Expected safer claim: The completed writes are listed; blocked writes are documented and not forced.
