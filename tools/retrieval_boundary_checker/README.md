# Retrieval Boundary Checker

Executable Mirror Cartographer component for privacy-preserving research memory and evidence-boundary routing.

## Purpose

The checker prevents retrieved observations, literature notes, animal-care notes, or collaborator packets from being reused unless their boundary state is explicit. It is designed to block hidden privacy residue, vague source status, uncategorized claim level, stale evidence reuse, and unacknowledged missingness before hypothesis generation or collaborator export.

## Input shape

The CLI accepts a JSON array of packets. Each packet must include:

- `packet_id`: stable public-safe identifier.
- `source_status`: one of `synthetic`, `public`, `private_redacted`, `private_blocked`, `unknown`.
- `claim_status`: one of `observation`, `hypothesis`, `literature_note`, `animal_care_note`, `reviewed_evidence`, `action_guidance`, `cure_claim`, `unknown`.
- `privacy_status`: one of `public_safe`, `redacted`, `private`, `contains_identifier`, `unknown`.
- `missingness`: array of missing fields or uncertainty notes.
- `revision_reason`: human-readable reason for the packet’s current revision.
- `retrieval_context`: object with `requested_use`, `retrieved_at`, and optional `source_date`.
- `content_summary`: public-safe summary string.

## Output shape

The CLI prints JSON with:

- `packet_id`
- `allowed`: boolean
- `route`: `allow_reuse`, `redact_first`, `human_review`, or `block`
- `reasons`: array of blocking or review reasons
- `next_executable_action`

## Routing rules

- Block if privacy is `private`, `contains_identifier`, or `unknown`.
- Block if claim is `cure_claim` or `action_guidance` without `reviewed_evidence`.
- Review if source status is `unknown`.
- Review if missingness is absent or non-array.
- Review if retrieved context is incomplete.
- Redact first if source is `private_redacted` but privacy is not `redacted` or `public_safe`.
- Allow reuse only when source, claim, privacy, missingness, and retrieval context are explicit and safe.

## Acceptance criteria

1. Unsafe privacy packets are blocked.
2. Cure/action claims are blocked unless they are converted into reviewed evidence packets elsewhere.
3. Unknown source packets are routed to review.
4. Missing missingness metadata is routed to review.
5. Public-safe synthetic/public packets with explicit metadata are allowed.
6. CLI exits nonzero when any packet is blocked.

## Testability

Run:

`python tools/retrieval_boundary_checker/test_check_retrieval_boundaries.py`

Run CLI manually:

`python tools/retrieval_boundary_checker/check_retrieval_boundaries.py tools/retrieval_boundary_checker/fixtures.synthetic.json`
